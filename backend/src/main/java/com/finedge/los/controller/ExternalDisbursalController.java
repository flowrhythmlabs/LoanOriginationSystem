package com.finedge.los.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/** UAT integration boundary. Actual provider request/response contract must be verified before live use. */
@RestController
@RequestMapping("/api/staff/disbursal")
public class ExternalDisbursalController {
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String disbursalUrl, disbursalKey, loanUrl, loanKey;
    private final int timeout;

    public ExternalDisbursalController(JdbcTemplate db, ObjectMapper mapper,
        @Value("${finedge.integrations.disbursal.url:}") String disbursalUrl,
        @Value("${finedge.integrations.disbursal.api-key:}") String disbursalKey,
        @Value("${finedge.integrations.loan-account.url:}") String loanUrl,
        @Value("${finedge.integrations.loan-account.api-key:}") String loanKey,
        @Value("${finedge.integrations.timeout-seconds:30}") int timeout) {
        this.db=db;this.mapper=mapper;this.disbursalUrl=disbursalUrl;this.disbursalKey=disbursalKey;
        this.loanUrl=loanUrl;this.loanKey=loanKey;this.timeout=Math.max(3,Math.min(timeout,120));
        this.http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(this.timeout)).build();
    }
    public record DisbursalInput(String beneficiaryAccount, String beneficiaryIfsc, String reference) {}

    private Map<String,Object> latest(long id) {
        var rows=db.queryForList("SELECT application_id, request_id, status, loan_number, provider_status, provider_reference, updated_at FROM los_external_disbursal WHERE application_id=?",id);
        return rows.isEmpty()?Map.of("applicationId",id,"status","NOT_STARTED"):rows.get(0);
    }
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OPERATIONS','COMPLIANCE_AUDIT','CREDIT_MANAGER')")
    public Map<String,Object> status(@PathVariable long id) { return latest(id); }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasRole('OPERATIONS')")
    public synchronized Map<String,Object> process(@PathVariable long id, @RequestBody DisbursalInput input, Authentication auth) {
        if(disbursalUrl.isBlank() || loanUrl.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Disbursal and loan-account provider URLs are not configured");
        if(!disbursalUrl.startsWith("https://") || !loanUrl.startsWith("https://"))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Provider URLs must use HTTPS");
        if(input==null || input.beneficiaryAccount()==null || !input.beneficiaryAccount().matches("[0-9]{6,20}") ||
           input.beneficiaryIfsc()==null || !input.beneficiaryIfsc().matches("[A-Z]{4}0[A-Z0-9]{6}") ||
           input.reference()==null || !input.reference().matches("[A-Za-z0-9._/-]{3,100}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Valid beneficiary account, IFSC and reference required");
        var applications=db.queryForList("SELECT status,requested_loan_amount FROM loan_applications WHERE id=?",id);
        if(applications.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Application not found");
        if(!"APPROVED".equals(String.valueOf(applications.get(0).get("status"))))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Only approved applications can be disbursed");
        var prior=latest(id);
        if(!"NOT_STARTED".equals(prior.get("status")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Disbursal already attempted. Check status and reconcile before retrying.");
        String requestId=UUID.randomUUID().toString();
        db.update("INSERT INTO los_external_disbursal(application_id,request_id,status,updated_at) VALUES (?,?,'PENDING',now())",id,requestId);
        try {
            JsonNode result=post(disbursalUrl,disbursalKey,Map.of("applicationId",id,"requestId",requestId,
                "amount",applications.get(0).get("requested_loan_amount"),"beneficiaryAccount",input.beneficiaryAccount(),
                "beneficiaryIfsc",input.beneficiaryIfsc(),"reference",input.reference()));
            String providerStatus=result.path("status").asText("");
            String providerRef=result.path("reference").asText("");
            if("FAILED".equalsIgnoreCase(providerStatus) || "REJECTED".equalsIgnoreCase(providerStatus)) {
                db.update("UPDATE los_external_disbursal SET status='FAILED',provider_status=?,provider_reference=?,updated_at=now() WHERE application_id=?",providerStatus,providerRef,id);
                return latest(id);
            }
            if(!"SUCCESS".equalsIgnoreCase(providerStatus)) {
                db.update("UPDATE los_external_disbursal SET status='UNKNOWN',provider_status=?,updated_at=now() WHERE application_id=?",providerStatus,id);
                return latest(id);
            }
            // Successful disbursal acknowledgment; loan account creation is a separate operation.
            db.update("UPDATE los_external_disbursal SET status='DISBURSED_LOAN_PENDING',provider_status=?,provider_reference=?,updated_at=now() WHERE application_id=?",providerStatus,providerRef,id);
            try {
                JsonNode loan=post(loanUrl,loanKey,Map.of("applicationId",id,"requestId",requestId,"disbursalReference",providerRef));
                String loanNumber=loan.path("loanNumber").asText("");
                String loanStatus=loan.path("status").asText("");
                if(!loanNumber.isBlank() && "SUCCESS".equalsIgnoreCase(loanStatus))
                    db.update("UPDATE los_external_disbursal SET status='SUCCESS',loan_number=?,updated_at=now() WHERE application_id=?",loanNumber,id);
                else db.update("UPDATE los_external_disbursal SET status='LOAN_ACCOUNT_PENDING',provider_status=?,updated_at=now() WHERE application_id=?",loanStatus,id);
            } catch(Exception ignored) {
                db.update("UPDATE los_external_disbursal SET status='LOAN_ACCOUNT_PENDING',updated_at=now() WHERE application_id=?",id);
            }
        } catch(Exception ex) {
            // Provider may have executed the transfer before a timeout. Never auto-retry.
            db.update("UPDATE los_external_disbursal SET status='UNKNOWN',updated_at=now() WHERE application_id=?",id);
        }
        return latest(id);
    }
    private JsonNode post(String url,String apiKey,Object payload) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(timeout))
            .header("Content-Type","application/json").header("Idempotency-Key",mapper.valueToTree(payload).path("requestId").asText())
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)));
        if(!apiKey.isBlank()) builder.header("X-API-Key",apiKey);
        HttpResponse<String> response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());
        if(response.statusCode()<200 || response.statusCode()>=300) throw new IllegalStateException("Provider HTTP "+response.statusCode());
        return mapper.readTree(response.body());
    }
}
