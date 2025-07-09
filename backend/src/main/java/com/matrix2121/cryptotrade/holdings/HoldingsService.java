package com.matrix2121.cryptotrade.holdings;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.holdings.dao.HoldingsDao;

@Service
public class HoldingsService {

    @Autowired
    private HoldingsDao holdingsDao;

    public List<HoldingsDto> getHoldingsByUserId(Long userId) {
        List<HoldingsModel> holdingsModel = holdingsDao.findByUserId(userId);
        return holdingsModel.stream()
            .map(HoldingsMapper::mapToDto)
            .toList();
    }

}
