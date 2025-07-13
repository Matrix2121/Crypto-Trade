package com.matrix2121.cryptotrade.userManagement.dao;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.exceptions.UserNotFoundException;
import com.matrix2121.cryptotrade.userManagement.UserMapper;
import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.dtos.UserLoginDto;

@Repository
public class UserDaoImpl implements UserDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public Optional<UserModel> getUserByUsername(UserLoginDto userLoginDto) {
        checkIfUserExistsByUsername(userLoginDto.username());
        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "select * from get_user_by_username(?)",
                UserMapper.mapToUserModel(),
                userLoginDto.username()));
    }

    @Override
    public Boolean resetUserByUserId(Long userId) {
        checkIfUserExistsById(userId);
        return jdbcTemplate.queryForObject(
            "select * from reset_user_by_id(?)",
            Boolean.class,
            userId);
    }

    private boolean checkIfUserExistsById(Long userId){
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ?",
                Integer.class,
                userId);
        if (count == null || count == 0) {
            throw new UserNotFoundException("User with ID " + userId + " not found");
        }
        return !(count > 0);
    }

    private boolean checkIfUserExistsByUsername(String username){
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where username = ?",
                Integer.class,
                username);
        if (count == null || count == 0) {
            throw new UserNotFoundException("User with username " + username + " not found");
        }
        return !(count > 0);
    }
}
