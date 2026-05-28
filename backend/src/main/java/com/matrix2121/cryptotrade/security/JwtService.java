package com.matrix2121.cryptotrade.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private static final String DEFAULT_SECRET =
            "change-me-change-me-change-me-change-me-change-me-change-me-32bytes-min";

    @Value("${jwt.secret:" + DEFAULT_SECRET + "}")
    private String secret;

    public String generateToken(User user) {
        String effectiveSecret = (secret == null || secret.isBlank()) ? DEFAULT_SECRET : secret;

        Date now = new Date();
        Date expiration = new Date(now.getTime() + 24L * 60L * 60L * 1000L);

        return Jwts.builder()
                .setSubject(user.email())
                .claim("id", user.id())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(
                        Keys.hmacShaKeyFor(effectiveSecret.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractUsername(String token) {
        String effectiveSecret = (secret == null || secret.isBlank()) ? DEFAULT_SECRET : secret;
        
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(effectiveSecret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean validateToken(String token) {
        try {
            String effectiveSecret = (secret == null || secret.isBlank()) ? DEFAULT_SECRET : secret;
            
            Jwts.parserBuilder()
                    .setSigningKey(Keys.hmacShaKeyFor(effectiveSecret.getBytes(StandardCharsets.UTF_8)))
                    .build()
                    .parseClaimsJws(token);
                    
            return true;
        } catch (Exception e) {
            System.out.println("Token validation failed: " + e.getMessage());
            return false;
        }
    }
}