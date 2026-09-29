package com.finedge.los.security;

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

@Component
public class DemoAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path.startsWith("/api/auth/") || path.startsWith("/error")) {
            filterChain.doFilter(request, response);
            return;
        }

        String roleHeader = request.getHeader("X-Role");
        if (roleHeader != null && !roleHeader.isBlank()) {
            String normalizedRole = roleHeader.trim().toUpperCase();
            String username = request.getHeader("X-Username");
            String mobile = request.getHeader("X-Mobile");

            if ("ADMIN".equals(normalizedRole) && "admin".equals(username)) {
                UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(
                        "admin",
                        "admin",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                );
                SecurityContextHolder.getContext().setAuthentication(token);
            } else if ("USER".equals(normalizedRole)) {
                if (mobile == null || !mobile.matches("^[0-9]{10}$")) {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Please enter a valid 10-digit mobile number.\"}");
                    return;
                }
                UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(
                        mobile,
                        mobile,
                        List.of(new SimpleGrantedAuthority("ROLE_USER"))
                );
                SecurityContextHolder.getContext().setAuthentication(token);
            }
        }

        filterChain.doFilter(request, response);
    }
}
