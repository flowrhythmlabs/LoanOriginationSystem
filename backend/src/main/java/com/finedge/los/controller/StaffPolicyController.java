package com.finedge.los.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.math.BigDecimal;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/staff/policy")
public class StaffPolicyController {
    private final JdbcTemplate db;
    private final ObjectMapper mapper = new ObjectMapper();
    public StaffPolicyController(JdbcTemplate db) {this.db=db;}
    @GetMapping("/products")
    @PreAuthorize("hasAnyRole('PRODUCT_POLICY_ADMIN','SUPER_ADMIN','CREDIT_MANAGER','COMPLIANCE_AUDIT')")
    public List<Map<String,Object>> products() {
        return db.queryForList("SELECT product_code,display_name,annual_rate,minimum_amount,maximum_amount,processing_fee_percent,gst_percent,minimum_tenure_months,maximum_tenure_months,enabled,configuration_version FROM product_configuration ORDER BY display_name");
    }
    @GetMapping("/changes")
    @PreAuthorize("hasAnyRole('PRODUCT_POLICY_ADMIN','SUPER_ADMIN','CREDIT_MANAGER','COMPLIANCE_AUDIT')")
    public List<Map<String,Object>> changes() {
        return db.queryForList("SELECT c.id,c.change_type,c.proposed_value::text AS proposed_value,c.status,c.reason,c.created_at,c.reviewed_at,s.username AS requested_by FROM staff_change_request c JOIN staff_account s ON s.id=c.requested_by ORDER BY c.created_at DESC,c.id DESC LIMIT 100");
    }
    @PostMapping("/changes")
    @PreAuthorize("hasRole('PRODUCT_POLICY_ADMIN')")
    public ResponseEntity<?> propose(@RequestBody Map<String,Object> input, Authentication auth) {
        String type=String.valueOf(input.getOrDefault("changeType", ""));
        if (!List.of("RATE_CARD", "PRODUCT_LIMITS", "FEES", "DOCUMENT_CHECKLIST", "ELIGIBILITY_RULES").contains(type)) return ResponseEntity.badRequest().body(Map.of("message","Unsupported change type"));
        Object proposed=input.get("proposedValue");
        if (!(proposed instanceof Map)) return ResponseEntity.badRequest().body(Map.of("message","proposedValue must be an object"));
        Long staffId=db.query("SELECT id FROM staff_account WHERE username=?", rs -> rs.next()?rs.getLong(1):null,auth.getName());
        if(staffId==null)return ResponseEntity.status(403).build();
        String json;
        try {json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(proposed);}catch(Exception e){return ResponseEntity.badRequest().build();}
        Long id=db.query("INSERT INTO staff_change_request(requested_by,change_type,proposed_value) VALUES (?, ?, CAST(? AS jsonb)) RETURNING id",rs -> rs.next()?rs.getLong(1):null,staffId,type,json);
        return ResponseEntity.ok(Map.of("changeRequestId",id,"status","PENDING"));
    }
    private static BigDecimal decimal(Object value, String field, BigDecimal min, BigDecimal max) {
        if (value == null) throw new IllegalArgumentException("Missing " + field);
        BigDecimal n = new BigDecimal(value.toString());
        if (n.compareTo(min)<0 || n.compareTo(max)>0) throw new IllegalArgumentException("Out-of-range " + field);
        return n;
    }
    private static String textValue(Map<String,Object> m,String key) {
        Object value=m.get(key);
        if(value==null || value.toString().isBlank()) throw new IllegalArgumentException("Missing " + key);
        return value.toString();
    }
    @PostMapping("/changes/{id}/review")
    @PreAuthorize("hasAnyRole('CREDIT_MANAGER','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<?> review(@PathVariable long id,@RequestBody Map<String,String> input,Authentication auth) {
        String decision=input.get("decision");
        if(!List.of("APPROVED","REJECTED").contains(decision))return ResponseEntity.badRequest().body(Map.of("message","Invalid decision"));
        String reason=input.get("reason");
        if(reason==null || reason.isBlank())return ResponseEntity.badRequest().body(Map.of("message","Reason is mandatory"));
        List<Map<String,Object>> requests=db.queryForList(
            "SELECT requested_by,change_type,proposed_value::text AS proposed_value,status FROM staff_change_request WHERE id=? FOR UPDATE",id);
        if(requests.isEmpty())return ResponseEntity.notFound().build();
        Map<String,Object> row=requests.get(0);
        if(!"PENDING".equals(row.get("status")))return ResponseEntity.status(409).body(Map.of("message","Change already reviewed"));
        Long checker=db.query("SELECT id FROM staff_account WHERE username=? AND enabled=true",rs->rs.next()?rs.getLong(1):null,auth.getName());
        if(checker==null)return ResponseEntity.status(403).build();
        if(checker.longValue()==((Number)row.get("requested_by")).longValue())
            return ResponseEntity.status(409).body(Map.of("message","Maker cannot approve their own proposal"));
        String type=String.valueOf(row.get("change_type"));
        Map<String,Object> proposed;
        try {
            proposed=mapper.readValue(String.valueOf(row.get("proposed_value")),new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
        } catch(Exception e) {return ResponseEntity.badRequest().body(Map.of("message","Invalid stored proposal"));}
        if("APPROVED".equals(decision)) {
        // Approval does not publish automatically: a separate validated product-config apply step is required.
            String product;
            try {product=textValue(proposed,"productCode");}
            catch(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}
            if(db.queryForObject("SELECT count(*) FROM product_configuration WHERE product_code=?",Integer.class,product)==0)
                return ResponseEntity.badRequest().body(Map.of("message","Unknown product code"));
            try {
                switch(type) {
                    case "RATE_CARD" -> {
                        BigDecimal rate=decimal(proposed.get("annualRate"),"annualRate",BigDecimal.ZERO,new BigDecimal("100"));
                        db.update("UPDATE product_configuration SET annual_rate=?,configuration_version=configuration_version+1,effective_from=now() WHERE product_code=?",rate,product);
                    }
                    case "FEES" -> {
                        BigDecimal fee=decimal(proposed.get("processingFeePercent"),"processingFeePercent",BigDecimal.ZERO,new BigDecimal("100"));
                        BigDecimal gst=decimal(proposed.get("gstPercent"),"gstPercent",BigDecimal.ZERO,new BigDecimal("100"));
                        db.update("UPDATE product_configuration SET processing_fee_percent=?,gst_percent=?,configuration_version=configuration_version+1,effective_from=now() WHERE product_code=?",fee,gst,product);
                    }
                    case "PRODUCT_LIMITS" -> {
                        BigDecimal min=decimal(proposed.get("minimumAmount"),"minimumAmount",BigDecimal.ONE,new BigDecimal("10000000000"));
                        BigDecimal max=decimal(proposed.get("maximumAmount"),"maximumAmount",min,new BigDecimal("10000000000"));
                        db.update("UPDATE product_configuration SET minimum_amount=?,maximum_amount=?,configuration_version=configuration_version+1,effective_from=now() WHERE product_code=?",min,max,product);
                    }
                    case "DOCUMENT_CHECKLIST" -> {
                        Object docs=proposed.get("requiredDocuments");
                        if(!(docs instanceof String) || ((String)docs).isBlank() || ((String)docs).length()>8000)
                            throw new IllegalArgumentException("requiredDocuments must be non-empty text (max 8000 characters)");
                        db.update("UPDATE product_configuration SET required_documents=?,configuration_version=configuration_version+1,effective_from=now() WHERE product_code=?",docs,product);
                    }
                    case "ELIGIBILITY_RULES" -> {
                        return ResponseEntity.status(409).body(Map.of("message","Eligibility rule publishing requires an approved versioned rule schema; request remains pending"));
                    }
                    default -> {return ResponseEntity.badRequest().body(Map.of("message","Unsupported change type"));}
                }
            } catch(IllegalArgumentException | ArithmeticException e) {
                return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));
            }
        }
        db.update("UPDATE staff_change_request SET status=?,reason=?,reviewed_at=now(),reviewed_by=? WHERE id=?",
            decision,reason.trim(),checker,id);
        db.update("INSERT INTO staff_audit_event(staff_id,action,reason_code) VALUES(?,?,?)",
            checker,"POLICY_"+decision,("CHANGE_"+id).substring(0,Math.min(80,("CHANGE_"+id).length())));
        return ResponseEntity.ok(Map.of("status",decision,"published","APPROVED".equals(decision)));
    }
}
