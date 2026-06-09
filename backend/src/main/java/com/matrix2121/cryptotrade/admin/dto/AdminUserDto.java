package com.matrix2121.cryptotrade.admin.dto;

public record AdminUserDto(
        Long id,
        String email,
        String username,
        boolean isAdmin) {
}
