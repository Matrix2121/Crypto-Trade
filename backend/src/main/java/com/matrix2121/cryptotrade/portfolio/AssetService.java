package com.matrix2121.cryptotrade.portfolio;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.portfolio.dao.AssetDao;

@Service
@Transactional
public class AssetService {

    @Autowired
    private AssetDao assetDao;

    public List<AssetDto> getAssetsByUserId(Long userId) {
        List<AssetModel> assetModelList = assetDao.findAssetsByUserId(userId);
        return assetModelList.stream()
            .map(AssetMapper::mapToAssetDto)
            .toList();
    }

}
