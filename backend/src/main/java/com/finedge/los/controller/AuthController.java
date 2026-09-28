package com.finedge.los.controller;

import com.finedge.los.dto.AuthRequest;
import com.finedge.los.service.DemoUserDetailsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AuthController {
    private final DemoUserDetailsService demoUserDetailsService;

    public AuthController(DemoUserDetailsService demoUserDetailsService) {
        this.demoUserDetailsService = demoUserDetailsService;
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
                "message", "Login successful"
        ));
    }
}
