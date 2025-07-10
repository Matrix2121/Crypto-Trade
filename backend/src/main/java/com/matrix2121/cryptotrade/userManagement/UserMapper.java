package com.matrix2121.cryptotrade.userManagement;

import org.springframework.jdbc.core.RowMapper;

import com.matrix2121.cryptotrade.userManagement.dtos.UserDto;

public class UserMapper {

    public static UserDto mapToUserDto(UserModel userModel) {
        return new UserDto(
                userModel.id(),
                userModel.username(),
                userModel.balance());
    }

    public static RowMapper<UserModel> mapToUserModel() {
        return (rs, i) -> new UserModel(
                rs.getLong("id"),
                rs.getString("username"),
                rs.getBigDecimal("balance"));
    }
}
