package com.matrix2121.cryptotrade.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // 1. Get the Authorization header from the request
        String authHeader = request.getHeader("Authorization");
        String jwt = null;
        String userEmail = null;

        // 2. Check if the header contains our Bearer token
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwt = authHeader.substring(7); // Remove "Bearer " prefix
            try {
                // Extract the email/subject from the token
                userEmail = jwtService.extractUsername(jwt); 
            } catch (Exception e) {
                System.out.println("Invalid JWT Token");
            }
        }

        // 3. If we found an email, and the user isn't already authenticated in this context...
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            
            // Validate the token (check expiration, signature, etc.)
            if (jwtService.validateToken(jwt)) {
                // 4. Tell Spring Security: "This user is valid, let them in!"
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userEmail, null, new ArrayList<>()); // Empty roles/authorities
                
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // 5. Continue processing the request
        filterChain.doFilter(request, response);
    }
}