package com.matrix2121.cryptotrade.favorites.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "user_favorite",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_favorite_user_symbol",
                columnNames = { "user_id", "symbol" }))
public class UserFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** e.g. BTC/USD */
    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    protected UserFavorite() {
    }

    public UserFavorite(Long userId, String symbol, Integer sortOrder) {
        this.userId = userId;
        this.symbol = symbol;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getSymbol() {
        return symbol;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }
}
