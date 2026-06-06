package com.matrix2121.cryptotrade.trades;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class TradeAmountResolver {

    public static final int CRYPTO_SCALE = 8;
    public static final int FIAT_SCALE = 5;

    private TradeAmountResolver() {
    }

    public static BigDecimal resolveCryptoAmount(
            BigDecimal cryptoAmount,
            BigDecimal fiatAmount,
            BigDecimal unitPrice) {
        if (fiatAmount != null && fiatAmount.compareTo(BigDecimal.ZERO) > 0) {
            if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Unit price unavailable");
            }
            return fiatAmount.divide(unitPrice, CRYPTO_SCALE, RoundingMode.HALF_UP);
        }

        if (cryptoAmount == null || cryptoAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Trade amount required");
        }

        return cryptoAmount.setScale(CRYPTO_SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal resolveFiatTotal(BigDecimal cryptoAmount, BigDecimal unitPrice) {
        return cryptoAmount
                .multiply(unitPrice)
                .setScale(FIAT_SCALE, RoundingMode.HALF_UP);
    }
}
