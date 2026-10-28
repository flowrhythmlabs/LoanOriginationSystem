package com.finedge.los.security;

import com.finedge.los.service.AuthSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;

@Component
public class BearerTokenAuthFilter extends OncePerRequestFilter {
    private final AuthSessionService sessions;
    private final JdbcTemplate db;
    public BearerTokenAuthFilter(AuthSessionService sessions, JdbcTemplate db) { this.sessions = sessions; this.db=db; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            AuthSessionService.Principal principal = sessions.findSession(header.substring(7).trim());
            if (principal != null) {
                if (principal.mobile() == null) {
                    var rows=db.queryForList("SELECT id FROM staff_account WHERE username=? AND enabled=true AND (locked_until IS NULL OR locked_until<now())",principal.username());
                    if(!rows.isEmpty()) {
                        long staffId=((Number)rows.get(0).get("id")).longValue();
                        var roles=db.queryForList("SELECT r.role_code FROM staff_account_role r JOIN staff_role_catalog c ON c.role_code=r.role_code AND c.enabled=true WHERE r.staff_id=?",String.class,staffId);
                        if(!roles.isEmpty()) SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(principal.username(),null,
                                roles.stream().map(role->new SimpleGrantedAuthority("ROLE_"+role)).toList()));
                    }
                } else {
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                        principal.mobile(),null,List.of(new SimpleGrantedAuthority("ROLE_"+principal.role()))));
                }
            }
        }
        chain.doFilter(request, response);
    }
}
