package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.context.CryptoPricesContext;
import com.matrix2121.cryptotrade.portfolio.PortfolioCostBasisCalculator.LedgerEntry;
import com.matrix2121.cryptotrade.portfolio.PortfolioCostBasisCalculator.ReplayResult;
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
        ReplayResult replay = PortfolioCostBasisCalculator.replay(txs);

        BigDecimal cashBalance = jdbcTemplate.queryForObject(
                "SELECT balance FROM users WHERE id = ?",
                BigDecimal.class,
                userId);

        List<AssetModel> currentAssets = fetchCurrentAssets(userId);
        List<AssetPnlDto> holdings = new ArrayList<>();
        BigDecimal totalCryptoValue = BigDecimal.ZERO;
        BigDecimal totalUnrealized = BigDecimal.ZERO;

        for (AssetModel asset : currentAssets) {
            BigDecimal quantityHeld = asset.cryptoAmount();
            if (quantityHeld == null || quantityHeld.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            LedgerEntry ledger = replay.byAsset()
                    .getOrDefault(asset.cryptoCode(), LedgerEntry.empty());
            BigDecimal costBasis = PortfolioCostBasisCalculator.costBasisForQuantity(ledger, quantityHeld);
            BigDecimal currentPrice = resolvePrice(asset.cryptoCode());
            BigDecimal marketValue = currentPrice.multiply(quantityHeld);
            BigDecimal avgEntry = quantityHeld.compareTo(BigDecimal.ZERO) > 0
                    ? costBasis.divide(quantityHeld, 8, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal unrealized = marketValue.subtract(costBasis);

            holdings.add(new AssetPnlDto(
                    asset.cryptoCode(),
                    quantityHeld,
                    costBasis,
                    ledger.realizedPnl(),
                    currentPrice,
                    marketValue,
                    avgEntry,
                    unrealized));
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
                replay.totalRealizedPnl(),
                holdings,
                allocation,
                valueHistory);
    }

    private List<AssetModel> fetchCurrentAssets(Long userId) {
        return jdbcTemplate.query(
                """
                SELECT a.id, a.crypto_code, a.crypto_amount, a.user_id
                FROM assets a
                WHERE a.user_id = ?
                  AND a.crypto_amount > 0
                ORDER BY a.crypto_code
                """,
                (rs, rowNum) -> new AssetModel(
                        rs.getLong("id"),
                        rs.getString("crypto_code"),
                        rs.getBigDecimal("crypto_amount"),
                        rs.getLong("user_id")),
                userId);
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
        if (cash.compareTo(BigDecimal.ZERO) > 0) {
            slices.add(new AllocationSliceDto("USD", cash, pct(cash, total)));
        }
        for (AssetPnlDto h : holdings) {
            if (h.marketValue().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
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
