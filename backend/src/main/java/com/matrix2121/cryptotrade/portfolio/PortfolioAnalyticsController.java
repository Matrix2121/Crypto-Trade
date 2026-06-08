package com.matrix2121.cryptotrade.portfolio;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioAnalyticsController {

    private final PortfolioAnalyticsService analyticsService;

    public PortfolioAnalyticsController(PortfolioAnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/analytics/{userId}")
    public PortfolioAnalyticsDto analytics(@PathVariable Long userId) {
        return analyticsService.getAnalytics(userId);
    }
}
