package com.matrix2121.cryptotrade.cryptoPrices.initialStream;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.cryptoPrices.krakenClient.model.PriceTick;

@RestController
@RequestMapping("/api/prices")
public class PricesController {
    
    @Autowired
    private PricesService pricesService;

    @GetMapping("")
    public List<PriceTick> getAllPrices() {
        return pricesService.getAllPrices();
    }
}
