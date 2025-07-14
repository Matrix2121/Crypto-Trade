package com.matrix2121.cryptotrade.portfolio.dao;

import java.util.List;

import com.matrix2121.cryptotrade.portfolio.AssetModel;

public interface AssetDao {
    public List<AssetModel> getAssetsByUserId(Long userId);
}
