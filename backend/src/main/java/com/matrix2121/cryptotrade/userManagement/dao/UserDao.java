package com.matrix2121.cryptotrade.userManagement.dao;

import java.math.BigDecimal;
import java.util.Optional;

import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.dtos.UserLoginDto;

public interface UserDao {
    public Optional<UserModel> getUserByUsername(UserLoginDto userLoginDto);
    public Optional<UserModel> getUserByEmail(String email);
    public UserModel createUser(String email, String username, BigDecimal balance, String pictureUrl);
    public Boolean resetUserByUserId(Long userId);
}
