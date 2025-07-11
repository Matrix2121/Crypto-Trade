package com.matrix2121.cryptotrade.trades;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.portfolio.AssetDto;

import io.swagger.v3.oas.annotations.parameters.RequestBody;

@RestController
@RequestMapping("/api/trade")
public class TradeController {
    
    @Autowired
    private TradeService tradeService;

    @PostMapping("/sell/{userId}")
    public TradeDto sellCrypto(@PathVariable Long userId, @RequestBody AssetDto assetDto){
        return tradeService.sellCrypto(userId, assetDto);
    }

    @PostMapping("/buy/{userId}")
    public TradeDto buyCrypto(@PathVariable Long userId, @RequestBody AssetDto assetDto){
        return tradeService.buyCrypto(userId, assetDto);
    }
}
