package com.matrix2121.cryptotrade.portfolio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.matrix2121.cryptotrade.transactions.TransactionModel;

/**
 * Replays transactions in chronological order to derive cost basis and realized P&amp;L.
 */
public final class PortfolioCostBasisCalculator {

    private PortfolioCostBasisCalculator() {
    }

    public record LedgerEntry(
            BigDecimal quantityHeld,
            BigDecimal costBasisTotal,
            BigDecimal realizedPnl) {

        static LedgerEntry empty() {
            return new LedgerEntry(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    public record ReplayResult(
            Map<String, LedgerEntry> byAsset,
            BigDecimal totalRealizedPnl) {
    }

    public static ReplayResult replay(List<TransactionModel> transactions) {
        List<TransactionModel> ordered = transactions.stream()
                .sorted(Comparator
                        .comparing(TransactionModel::tradeTimestamp)
                        .thenComparing(TransactionModel::id, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        Map<String, LedgerEntry> byAsset = new HashMap<>();
        BigDecimal totalRealizedPnl = BigDecimal.ZERO;

        for (TransactionModel tx : ordered) {
            String code = tx.cryptoCode();
            LedgerEntry entry = byAsset.getOrDefault(code, LedgerEntry.empty());

            if (Boolean.TRUE.equals(tx.isPurchase())) {
                byAsset.put(code, new LedgerEntry(
                        entry.quantityHeld().add(tx.cryptoAmount()),
                        entry.costBasisTotal().add(tx.localCurrencyAmount()),
                        entry.realizedPnl()));
                continue;
            }

            BigDecimal avgEntry = entry.quantityHeld().compareTo(BigDecimal.ZERO) > 0
                    ? entry.costBasisTotal().divide(entry.quantityHeld(), 8, RoundingMode.HALF_UP)
                    : tx.unitPrice();
            BigDecimal costSold = avgEntry.multiply(tx.cryptoAmount());
            BigDecimal saleProceeds = tx.localCurrencyAmount();
            BigDecimal tradeRealized = saleProceeds.subtract(costSold);
            totalRealizedPnl = totalRealizedPnl.add(tradeRealized);

            BigDecimal newQty = entry.quantityHeld().subtract(tx.cryptoAmount()).max(BigDecimal.ZERO);
            BigDecimal newCost = entry.costBasisTotal().subtract(costSold).max(BigDecimal.ZERO);
            byAsset.put(code, new LedgerEntry(
                    newQty,
                    newCost,
                    entry.realizedPnl().add(tradeRealized)));
        }

        return new ReplayResult(byAsset, totalRealizedPnl);
    }

    public static BigDecimal costBasisForQuantity(LedgerEntry ledger, BigDecimal actualQty) {
        if (actualQty == null || actualQty.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (ledger == null || ledger.quantityHeld().compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (actualQty.compareTo(ledger.quantityHeld()) == 0) {
            return ledger.costBasisTotal();
        }
        BigDecimal avgEntry = ledger.costBasisTotal()
                .divide(ledger.quantityHeld(), 8, RoundingMode.HALF_UP);
        return avgEntry.multiply(actualQty);
    }
}
