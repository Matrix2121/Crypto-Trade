package com.matrix2121.cryptotrade.userManagement;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.userManagement.dtos.*;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("login")
    public UserDto loginwithUsername(@RequestBody UserLoginDto userLoginDto) {
        return userService.getUserByLoginDto(userLoginDto);
    }
}
