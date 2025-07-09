package com.matrix2121.cryptotrade.portfolio.dao;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.portfolio.AssetMapper;
import com.matrix2121.cryptotrade.portfolio.AssetModel;

import java.util.List;

@Repository
public class AssetDaoImpl implements AssetDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<AssetModel> findAssetsByUserId(long userId) {
        return jdbcTemplate.queryForStream(
            "SELECT * FROM get_assets_by_user_id(?)", 
            AssetMapper.mapToAssetModel(), 
            userId)
            .toList();
    }
}
