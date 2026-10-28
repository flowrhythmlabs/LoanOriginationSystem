package com.finedge.los.controller;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/staff/audit")
@PreAuthorize("hasAnyRole('COMPLIANCE_AUDIT','SUPER_ADMIN')")
public class StaffAuditController {
 private final JdbcTemplate db;
 public StaffAuditController(JdbcTemplate db){this.db=db;}
 @GetMapping("/events")
 public List<Map<String,Object>> events(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size){
  int limit=Math.max(1,Math.min(size,100)),offset=Math.max(0,page)*limit;
  return db.queryForList("SELECT e.id,s.username AS actor,e.application_id,e.action,e.reason_code,e.created_at FROM staff_audit_event e LEFT JOIN staff_account s ON s.id=e.staff_id ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?",limit,offset);
 }
}
