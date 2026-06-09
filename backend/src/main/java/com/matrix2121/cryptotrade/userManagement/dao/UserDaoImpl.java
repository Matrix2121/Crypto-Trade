package com.matrix2121.cryptotrade.userManagement.dao;

import java.math.BigDecimal;
import java.util.List;
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
                "select id, username, email, balance, picture_url, is_admin from users where username = ?",
                UserMapper.mapToUserModel(),
                userLoginDto.username()));
    }

    @Override
    public Optional<UserModel> getUserByEmail(String email) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where email = ?",
                Integer.class,
                email);
        if (count == null || count == 0) {
            return Optional.empty();
        }

        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "select id, username, balance, email, picture_url, is_admin from users where email = ?",
                UserMapper.mapToUserModel(),
                email));
    }

    @Override
    public Optional<UserModel> findUserById(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ?",
                Integer.class,
                userId);
        if (count == null || count == 0) {
            return Optional.empty();
        }
        return Optional.ofNullable(jdbcTemplate.queryForObject(
                "select id, username, email, balance, picture_url, is_admin from users where id = ?",
                UserMapper.mapToUserModel(),
                userId));
    }

    @Override
    public List<UserModel> findAllUsers() {
        return jdbcTemplate.query(
                "select id, username, email, balance, picture_url, is_admin from users order by id",
                UserMapper.mapToUserModel());
    }

    @Override
    public UserModel setAdminByUserId(Long userId, boolean isAdmin) {
        checkIfUserExistsById(userId);
        return jdbcTemplate.queryForObject(
                "update users set is_admin = ? where id = ? returning id, username, email, balance, picture_url, is_admin",
                UserMapper.mapToUserModel(),
                isAdmin,
                userId);
    }

    @Override
    public UserModel createUser(String email, String username, BigDecimal balance, String pictureUrl) {
        return jdbcTemplate.queryForObject(
                "insert into users (email, username, balance, picture_url) values (?, ?, ?, ?) returning id, username, balance, email, picture_url, is_admin",
                UserMapper.mapToUserModel(),
                email,
                username,
                balance,
                pictureUrl);
    }

    @Override
    public Boolean resetUserByUserId(Long userId) {
        checkIfUserExistsById(userId);
        return jdbcTemplate.queryForObject(
            "select * from reset_user_by_id(?)",
            Boolean.class,
            userId);
    }

    @Override
    public void ensureUserExists(Long userId) {
        checkIfUserExistsById(userId);
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
