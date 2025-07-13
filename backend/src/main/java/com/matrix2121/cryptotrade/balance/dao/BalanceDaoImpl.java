package com.matrix2121.cryptotrade.balance.dao;

import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.balance.BalanceDto;
import com.matrix2121.cryptotrade.balance.BalanceMapper;
import com.matrix2121.cryptotrade.exceptions.UserNotFoundException;

@Repository
public class BalanceDaoImpl implements BalanceDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public BalanceDto getBalanceByUserId(Long userId) {
        BigDecimal balance = jdbcTemplate.queryForObject(
                "select * from get_balance_by_user_id(?)",
                BigDecimal.class,
                userId);

        if (balance == null) {
            throw new UserNotFoundException("User with ID " + userId + " not found");
        }
        return BalanceMapper.mapToBalanceDto(balance);
    }
}
