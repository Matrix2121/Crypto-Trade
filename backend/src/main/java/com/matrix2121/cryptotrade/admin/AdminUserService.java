package com.matrix2121.cryptotrade.admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.matrix2121.cryptotrade.admin.dto.AdminUserDto;
import com.matrix2121.cryptotrade.userManagement.UserModel;
import com.matrix2121.cryptotrade.userManagement.dao.UserDao;

@Service
public class AdminUserService {

    private final UserDao userDao;

    public AdminUserService(UserDao userDao) {
        this.userDao = userDao;
    }

    public List<AdminUserDto> listUsers() {
        return userDao.findAllUsers().stream()
                .map(this::toDto)
                .toList();
    }

    public AdminUserDto setAdmin(Long userId, boolean isAdmin, String actingUserEmail) {
        UserModel target = userDao.findUserById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        if (!isAdmin && target.email().equalsIgnoreCase(actingUserEmail)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "You cannot remove your own admin access");
        }

        UserModel updated = userDao.setAdminByUserId(userId, isAdmin);
        return toDto(updated);
    }

    private AdminUserDto toDto(UserModel user) {
        return new AdminUserDto(user.id(), user.email(), user.username(), user.isAdmin());
    }
}
