package com.matrix2121.cryptotrade.userManagement;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.userManagement.dao.UserDao;
import com.matrix2121.cryptotrade.userManagement.dtos.*;

@Service
public class UserService {
    
    @Autowired
    private UserDao userDao;

    public UserDto getUserByLoginDto(UserLoginDto userLoginDto){
        return userDao.getUserByUsername(userLoginDto)
                .map(UserMapper::mapToUserDto)
                .orElse(null);
    }

    public Boolean resetUserByUserId(Long userId){
        return userDao.resetUserByUserId(userId);
    }
}
