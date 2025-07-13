package com.matrix2121.cryptotrade.portfolio.dao;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.matrix2121.cryptotrade.exceptions.NoAssetsException;
import com.matrix2121.cryptotrade.exceptions.UserNotFoundException;
import com.matrix2121.cryptotrade.portfolio.AssetMapper;
import com.matrix2121.cryptotrade.portfolio.AssetModel;

import java.util.List;

@Repository
public class AssetDaoImpl implements AssetDao {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public List<AssetModel> getAssetsByUserId(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ?",
                Integer.class,
                userId);
        if (count == null || count == 0) {
            throw new UserNotFoundException("User with ID " + userId + " not found");
        }

        List<AssetModel> assetsList =  jdbcTemplate.queryForStream(
                "select * from get_assets_by_user_id(?)",
                AssetMapper.mapToAssetModel(),
                userId)
                .toList();
        if(assetsList.size() == 0){
            throw new NoAssetsException("User doesn't have assets");
        }

        return assetsList;
    }
}
