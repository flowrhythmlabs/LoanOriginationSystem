package com.finedge.los.controller;

import com.finedge.los.service.StaffIdentityService;
import com.finedge.los.service.AuthSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/staff/auth")
public class StaffAuthController {
    private final StaffIdentityService staff;
    private final AuthSessionService sessions;
    @Value("${app.auth.staff-mfa-enabled:true}")
    private boolean staffMfaEnabled;
    public StaffAuthController(StaffIdentityService staff, AuthSessionService sessions) {this.staff=staff;this.sessions=sessions;}
    @PostMapping("/password")
    public ResponseEntity<?> password(@RequestBody Map<String,String> input) {
        try {
            String challengeId = staff.passwordStep(input.get("username"),input.get("password"));
            if (staffMfaEnabled) return ResponseEntity.ok(Map.of("challengeId", challengeId, "mfaRequired", true));
            return ResponseEntity.ok(staff.completePasswordLogin(challengeId, sessions));
        }
        catch(SecurityException e){return ResponseEntity.status(401).body(Map.of("message",e.getMessage()));}
    }
    @PostMapping("/mfa")
    public ResponseEntity<?> mfa(@RequestBody Map<String,String> input) {
        if (!staffMfaEnabled) return ResponseEntity.status(403).body(Map.of("message", "Staff MFA is disabled."));
        try{return ResponseEntity.ok(staff.mfaStep(input.get("challengeId"),input.get("code"),sessions));}
        catch(SecurityException e){return ResponseEntity.status(401).body(Map.of("message",e.getMessage()));}
    }
}
