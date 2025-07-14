package com.matrix2121.cryptotrade.portfolio;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    @Autowired
    private AssetService assetService;

    @GetMapping("/{userId}")
    public List<AssetDto> getAssetsByUserId(@PathVariable Long userId) {
        return assetService.getAssetsByUserId(userId);
    }
}
