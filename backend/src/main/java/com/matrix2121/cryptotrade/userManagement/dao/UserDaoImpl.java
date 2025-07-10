package com.matrix2121.cryptotrade.userManagement.dao;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.matrix2121.cryptotrade.userManagement.UserMapper;
import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.dtos.UserLoginDto;

public class UserDaoImpl implements UserDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public Optional<UserModel> getUserByUsername(UserLoginDto userLoginDto) {
        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "select * from get_user_by_username(?)",
                UserMapper.mapToUserModel(),
                userLoginDto.username()));
    }

}
