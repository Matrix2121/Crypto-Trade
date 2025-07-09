package com.matrix2121.cryptotrade.holdings.dao;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.holdings.HoldingsMapper;
import com.matrix2121.cryptotrade.holdings.HoldingsModel;

import java.util.List;

@Repository
public class HoldingsDaoImpl {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<HoldingsModel> findByUserId(long userId) {
        return jdbcTemplate.queryForStream(
            "SELECT * FROM get_portfolio_by_id(?)", 
            HoldingsMapper.mapToModel(), 
            userId)
            .toList();
    }
}
