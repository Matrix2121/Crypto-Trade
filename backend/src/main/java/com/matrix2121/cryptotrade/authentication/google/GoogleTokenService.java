package com.matrix2121.cryptotrade.authentication.google;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

@Service
public class GoogleTokenService {

    @Value("${google.client.id}")
    private String clientId;

    @Value("${google.android.client.id:}")
    private String androidClientId;

    public Payload verifyGoogleToken(String token) {
        try {
            return verifyTokenPayload(token);
        } catch (IOException | GeneralSecurityException e) {
            throw new IllegalStateException("Failed to verify Google Token", e);
        }
    }

    private Payload verifyTokenPayload(String token) throws IOException, GeneralSecurityException {
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();

        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                transport,
                GsonFactory.getDefaultInstance())
                .setAudience(acceptedAudiences())
                .build();

        GoogleIdToken idToken = verifier.verify(token);
        if (idToken == null) {
            throw new IllegalArgumentException("Invalid ID token.");
        }

        return idToken.getPayload();
    }

    private List<String> acceptedAudiences() {
        List<String> audiences = new ArrayList<>();
        audiences.add(clientId);
        if (StringUtils.hasText(androidClientId)) {
            audiences.add(androidClientId);
        }
        return audiences;
    }
}