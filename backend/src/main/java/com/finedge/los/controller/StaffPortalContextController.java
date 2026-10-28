package com.finedge.los.controller;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/staff/portal")
public class StaffPortalContextController {
    @GetMapping("/context")
    public Map<String,Object> context(Authentication auth) {
        List<String> roles=auth.getAuthorities().stream().map(a->a.getAuthority()).filter(r->r.startsWith("ROLE_")).map(r->r.substring(5)).toList();
        return Map.of("username",auth.getName(),"roles",roles);
    }
}
