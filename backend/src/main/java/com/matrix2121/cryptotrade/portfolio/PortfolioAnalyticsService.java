package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.transactions.TransactionModel;
import com.matrix2121.cryptotrade.transactions.dao.TransactionDao;

@Service
public class PortfolioAnalyticsService {

    private final TransactionDao transactionDao;
    private final JdbcTemplate jdbcTemplate;

    public PortfolioAnalyticsService(
            TransactionDao transactionDao,
            JdbcTemplate jdbcTemplate) {
        this.transactionDao = transactionDao;
        this.jdbcTemplate = jdbcTemplate;
    }

    public PortfolioAnalyticsDto getAnalytics(Long userId) {
        List<TransactionModel> txs = safeTransactions(userId);
        BigDecimal cashBalance = jdbcTemplate.queryForObject(
                "SELECT balance FROM users WHERE id = ?",
                BigDecimal.class,
                userId);

        Map<String, AssetPnlDto> byAsset = new HashMap<>();
        BigDecimal realizedPnl = BigDecimal.ZERO;

        for (TransactionModel tx : txs) {
            String code = tx.cryptoCode();
            AssetPnlDto entry = byAsset.computeIfAbsent(code, c -> new AssetPnlDto(
                    c, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));

            if (Boolean.TRUE.equals(tx.isPurchase())) {
                entry = new AssetPnlDto(
                        code,
                        entry.quantityHeld().add(tx.cryptoAmount()),
                        entry.costBasisTotal().add(tx.localCurrencyAmount()),
                        entry.realizedPnl(),
                        entry.currentPrice(),
                        entry.marketValue());
                byAsset.put(code, entry);
            } else {
                BigDecimal avgEntry = entry.quantityHeld().compareTo(BigDecimal.ZERO) > 0
                        ? entry.costBasisTotal().divide(entry.quantityHeld(), 8, RoundingMode.HALF_UP)
                        : tx.unitPrice();
                BigDecimal costSold = avgEntry.multiply(tx.cryptoAmount());
                BigDecimal saleProceeds = tx.localCurrencyAmount();
                realizedPnl = realizedPnl.add(saleProceeds.subtract(costSold));

                BigDecimal newQty = entry.quantityHeld().subtract(tx.cryptoAmount()).max(BigDecimal.ZERO);
                BigDecimal newCost = entry.costBasisTotal().subtract(costSold).max(BigDecimal.ZERO);
                byAsset.put(code, new AssetPnlDto(
                        code, newQty, newCost, entry.realizedPnl(), entry.currentPrice(), entry.marketValue()));
            }
        }

        List<AssetPnlDto> holdings = new ArrayList<>();
        BigDecimal totalCryptoValue = BigDecimal.ZERO;
        BigDecimal totalUnrealized = BigDecimal.ZERO;

        for (AssetPnlDto entry : byAsset.values()) {
            if (entry.quantityHeld().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            BigDecimal currentPrice = resolvePrice(entry.cryptoCode());
            BigDecimal marketValue = currentPrice.multiply(entry.quantityHeld());
            BigDecimal avgEntry = entry.costBasisTotal().divide(entry.quantityHeld(), 8, RoundingMode.HALF_UP);
            BigDecimal unrealized = marketValue.subtract(entry.costBasisTotal());

            AssetPnlDto enriched = new AssetPnlDto(
                    entry.cryptoCode(),
                    entry.quantityHeld(),
                    entry.costBasisTotal(),
                    entry.realizedPnl(),
                    currentPrice,
                    marketValue,
                    avgEntry,
                    unrealized);
            holdings.add(enriched);
            totalCryptoValue = totalCryptoValue.add(marketValue);
            totalUnrealized = totalUnrealized.add(unrealized);
        }

        BigDecimal totalPortfolio = cashBalance.add(totalCryptoValue);
        List<AllocationSliceDto> allocation = buildAllocation(cashBalance, holdings, totalPortfolio);
        List<PortfolioValuePointDto> valueHistory = buildValueHistory(txs, cashBalance, totalPortfolio);

        return new PortfolioAnalyticsDto(
                totalPortfolio,
                cashBalance,
                totalCryptoValue,
                totalUnrealized,
                realizedPnl,
                holdings,
                allocation,
                valueHistory);
    }

    private List<TransactionModel> safeTransactions(Long userId) {
        try {
            return transactionDao.findTransactionsByUserId(userId);
        } catch (Exception e) {
            return List.of();
        }
    }

    private BigDecimal resolvePrice(String cryptoCode) {
        BigDecimal bid = CryptoPricesContext.getBidMap().get(cryptoCode);
        if (bid != null) {
            return bid;
        }
        return BigDecimal.ZERO;
    }

    private List<AllocationSliceDto> buildAllocation(
            BigDecimal cash, List<AssetPnlDto> holdings, BigDecimal total) {
        List<AllocationSliceDto> slices = new ArrayList<>();
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            return slices;
        }
        slices.add(new AllocationSliceDto("USD", cash, pct(cash, total)));
        for (AssetPnlDto h : holdings) {
            slices.add(new AllocationSliceDto(h.cryptoCode(), h.marketValue(), pct(h.marketValue(), total)));
        }
        return slices;
    }

    private static BigDecimal pct(BigDecimal part, BigDecimal total) {
        return part.multiply(BigDecimal.valueOf(100))
                .divide(total, 2, RoundingMode.HALF_UP);
    }

    private List<PortfolioValuePointDto> buildValueHistory(
            List<TransactionModel> txs, BigDecimal currentCash, BigDecimal currentTotal) {
        if (txs.isEmpty()) {
            return List.of(new PortfolioValuePointDto("now", currentTotal, currentCash));
        }
        List<PortfolioValuePointDto> points = new ArrayList<>();
        points.add(new PortfolioValuePointDto(
                txs.get(0).tradeTimestamp().toString(),
                currentTotal,
                currentCash));
        points.add(new PortfolioValuePointDto("now", currentTotal, currentCash));
        return points;
    }
}
