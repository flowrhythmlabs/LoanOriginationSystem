package com.finedge.los.controller;

import com.finedge.los.dto.AuthRequest;
import com.finedge.los.service.DemoUserDetailsService;
import com.finedge.los.security.DemoTokenService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final DemoUserDetailsService demoUserDetailsService;
    private final DemoTokenService tokenService;

    public AuthController(DemoUserDetailsService demoUserDetailsService, DemoTokenService tokenService) {
        this.demoUserDetailsService = demoUserDetailsService;
        this.tokenService = tokenService;
    }

    @PostMapping("/auth/login/user")
    public ResponseEntity<Map<String, Object>> loginUser(@Valid @RequestBody AuthRequest request) {
        if (request == null || request.getMobileNumber() == null || request.getOtp() == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Mobile number and OTP are required"));
        }

        String mobileNumber = request.getMobileNumber();
        if (!demoUserDetailsService.validateUserOtp(mobileNumber, request.getOtp())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid OTP"));
        }

        demoUserDetailsService.registerUser(mobileNumber, request.getOtp());
        return ResponseEntity.ok(Map.of(
                "role", "USER",
            "mobileNumber", mobileNumber,
            "token", tokenService.issue(mobileNumber, "USER"),
                "message", "Login successful"
        ));
    }

    @PostMapping("/auth/login/admin")
    public ResponseEntity<Map<String, Object>> loginAdmin(@RequestBody AuthRequest request) {
        if (request == null || request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Admin credentials are required"));
        }

        if (!demoUserDetailsService.validateAdmin(request.getUsername(), request.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid admin credentials"));
        }

        return ResponseEntity.ok(Map.of(
                "role", "ADMIN",
                "username", request.getUsername(),
                "token", tokenService.issue("admin", "ADMIN"),
                "message", "Login successful"
        ));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            tokenService.revoke(authorization.substring(7).trim());
        }
        return ResponseEntity.noContent().build();
    }
}
