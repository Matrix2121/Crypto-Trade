package com.matrix2121.cryptotrade.authentication.google;

import com.matrix2121.cryptotrade.authentication.google.dtos.GoogleObjectDto;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;

public class GoogleObjectMapper {
    
    public static GoogleObjectDto mapToGoogleObjectDto(Payload payload) {
        return new GoogleObjectDto(
            payload.getEmail(),
            (String) payload.get("name"),
            (String) payload.get("picture")
        );
    }
}
