package com.finedge.los.controller;

import com.finedge.los.service.StaffIdentityService;
import com.finedge.los.service.AuthSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/staff/auth")
public class StaffAuthController {
    private final StaffIdentityService staff;
    private final AuthSessionService sessions;
    public StaffAuthController(StaffIdentityService staff, AuthSessionService sessions) {this.staff=staff;this.sessions=sessions;}
    @PostMapping("/password")
    public ResponseEntity<?> password(@RequestBody Map<String,String> input) {
        try {return ResponseEntity.ok(Map.of("challengeId",staff.passwordStep(input.get("username"),input.get("password")),"mfaRequired",true));}
        catch(SecurityException e){return ResponseEntity.status(401).body(Map.of("message",e.getMessage()));}
    }
    @PostMapping("/mfa")
    public ResponseEntity<?> mfa(@RequestBody Map<String,String> input) {
        try{return ResponseEntity.ok(staff.mfaStep(input.get("challengeId"),input.get("code"),sessions));}
        catch(SecurityException e){return ResponseEntity.status(401).body(Map.of("message",e.getMessage()));}
    }
}
