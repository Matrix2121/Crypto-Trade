package com.matrix2121.cryptotrade.favorites;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.matrix2121.cryptotrade.favorites.dto.FavoritesResponse;
import com.matrix2121.cryptotrade.favorites.persistence.UserFavorite;
import com.matrix2121.cryptotrade.favorites.persistence.UserFavoriteRepository;
import com.matrix2121.cryptotrade.userManagement.dao.UserDao;

@Service
public class FavoriteService {

    private final UserFavoriteRepository userFavoriteRepository;
    private final UserDao userDao;

    public FavoriteService(UserFavoriteRepository userFavoriteRepository, UserDao userDao) {
        this.userFavoriteRepository = userFavoriteRepository;
        this.userDao = userDao;
    }

    public FavoritesResponse getFavorites(Long userId) {
        userDao.ensureUserExists(userId);
        return toResponse(userFavoriteRepository.findByUserIdOrderBySortOrderAsc(userId));
    }

    @Transactional
    public FavoritesResponse toggleFavorite(Long userId, String rawSymbol) {
        userDao.ensureUserExists(userId);
        String symbol = normalizeSymbol(rawSymbol);

        userFavoriteRepository.findByUserIdAndSymbol(userId, symbol).ifPresentOrElse(
                existing -> userFavoriteRepository.deleteByUserIdAndSymbol(userId, symbol),
                () -> {
                    int nextOrder = userFavoriteRepository.findMaxSortOrderByUserId(userId) + 1;
                    userFavoriteRepository.save(new UserFavorite(userId, symbol, nextOrder));
                });

        return toResponse(userFavoriteRepository.findByUserIdOrderBySortOrderAsc(userId));
    }

    static String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new IllegalArgumentException("Symbol is required");
        }
        return symbol.replace("-", "/").trim().toUpperCase();
    }

    static String toPathSymbol(String symbol) {
        return symbol.replace("/", "-");
    }

    private FavoritesResponse toResponse(List<UserFavorite> favorites) {
        List<String> symbols = favorites.stream()
                .map(UserFavorite::getSymbol)
                .map(FavoriteService::toPathSymbol)
                .toList();
        return new FavoritesResponse(symbols);
    }
}
