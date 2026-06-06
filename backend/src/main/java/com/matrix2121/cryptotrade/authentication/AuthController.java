package com.matrix2121.cryptotrade.authentication;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
import com.matrix2121.cryptotrade.authentication.google.GoogleObjectMapper;
import com.matrix2121.cryptotrade.authentication.google.GoogleTokenService;
import com.matrix2121.cryptotrade.authentication.google.dtos.GoogleObjectDto;
import com.matrix2121.cryptotrade.balance.BalanceDto;
import com.matrix2121.cryptotrade.balance.BalanceService;
import com.matrix2121.cryptotrade.security.JwtService;
import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @Autowired
    private GoogleTokenService googleTokenService;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private BalanceService balanceService;

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(@RequestBody TokenRequest request) {
        Payload payload = googleTokenService.verifyGoogleToken(request.token());
        GoogleObjectDto googleData = GoogleObjectMapper.mapToGoogleObjectDto(payload);

        UserModel user = userService.processOAuthPostLogin(googleData);
        String jwt = jwtService.generateToken(user);

        BalanceDto balance = balanceService.getBalanceByUserId(user.id());

        return ResponseEntity.ok(new AuthResponse(
                user.id(), jwt, user.username(), balance.balance(), user.isAdmin(), user.pictureUrl()));
    }
}
