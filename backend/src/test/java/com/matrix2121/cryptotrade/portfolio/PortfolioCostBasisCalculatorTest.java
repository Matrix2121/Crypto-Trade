package com.matrix2121.cryptotrade.portfolio;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.matrix2121.cryptotrade.transactions.TransactionModel;

class PortfolioCostBasisCalculatorTest {

    @Test
    void replayProcessesTransactionsChronologicallyEvenWhenNewestFirst() {
        Instant buyTime = Instant.parse("2026-06-19T10:00:00Z");
        Instant sellTime = Instant.parse("2026-06-19T11:00:00Z");

        TransactionModel buy = new TransactionModel(
                1L,
                "BTC/USD",
                new BigDecimal("50000"),
                new BigDecimal("0.1"),
                new BigDecimal("5000"),
                true,
                buyTime,
                1L);
        TransactionModel sell = new TransactionModel(
                2L,
                "BTC/USD",
                new BigDecimal("51000"),
                new BigDecimal("0.1"),
                new BigDecimal("5100"),
                false,
                sellTime,
                1L);

        PortfolioCostBasisCalculator.ReplayResult result =
                PortfolioCostBasisCalculator.replay(List.of(sell, buy));

        PortfolioCostBasisCalculator.LedgerEntry btc =
                result.byAsset().getOrDefault("BTC/USD", PortfolioCostBasisCalculator.LedgerEntry.empty());

        assertEquals(0, btc.quantityHeld().compareTo(BigDecimal.ZERO));
        assertEquals(0, btc.costBasisTotal().compareTo(BigDecimal.ZERO));
        assertEquals(0, new BigDecimal("100").compareTo(result.totalRealizedPnl()));
    }

    @Test
    void costBasisForQuantityUsesAverageCostWhenPartiallySold() {
        PortfolioCostBasisCalculator.LedgerEntry ledger = new PortfolioCostBasisCalculator.LedgerEntry(
                new BigDecimal("0.5"),
                new BigDecimal("2500"),
                BigDecimal.ZERO);

        BigDecimal cost = PortfolioCostBasisCalculator.costBasisForQuantity(
                ledger,
                new BigDecimal("0.2"));

        assertEquals(0, new BigDecimal("1000").compareTo(cost));
    }

    @Test
    void replayLeavesOpenPositionWithRemainingCostBasis() {
        TransactionModel buy = new TransactionModel(
                1L,
                "ETH/USD",
                new BigDecimal("3000"),
                new BigDecimal("2"),
                new BigDecimal("6000"),
                true,
                Instant.parse("2026-06-19T09:00:00Z"),
                1L);

        PortfolioCostBasisCalculator.ReplayResult result =
                PortfolioCostBasisCalculator.replay(List.of(buy));

        PortfolioCostBasisCalculator.LedgerEntry eth =
                result.byAsset().get("ETH/USD");

        assertEquals(0, new BigDecimal("2").compareTo(eth.quantityHeld()));
        assertEquals(0, new BigDecimal("6000").compareTo(eth.costBasisTotal()));
        assertTrue(result.totalRealizedPnl().compareTo(BigDecimal.ZERO) == 0);
    }
}
