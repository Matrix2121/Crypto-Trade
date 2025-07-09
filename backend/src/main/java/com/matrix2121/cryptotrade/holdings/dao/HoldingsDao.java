package com.matrix2121.cryptotrade.holdings.dao;
import com.matrix2121.cryptotrade.holdings.HoldingsModel;

import java.util.List;

public interface HoldingsDao {
    public List<HoldingsModel> findByUserId(long userId);
}
