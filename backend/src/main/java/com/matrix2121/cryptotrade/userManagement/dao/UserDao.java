package com.matrix2121.cryptotrade.userManagement.dao;

import java.util.Optional;

import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.dtos.UserLoginDto;

public interface UserDao {
    public Optional<UserModel> getUserByUsername(UserLoginDto userLoginDto);
    public Boolean resetUserByUserId(Long userId);
}
