package com.matrix2121.cryptotrade.balance.dao;

import java.math.BigDecimal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.balance.BalanceDto;
import com.matrix2121.cryptotrade.balance.BalanceMapper;

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
        return BalanceMapper.mapToBalanceDto(balance);
    }
}
