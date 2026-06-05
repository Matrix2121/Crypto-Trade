package com.matrix2121.cryptotrade.favorites;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.matrix2121.cryptotrade.favorites.dto.FavoritesResponse;
import com.matrix2121.cryptotrade.favorites.dto.ToggleFavoriteRequest;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    @GetMapping("/{userId}")
    public FavoritesResponse getFavorites(@PathVariable Long userId) {
        return favoriteService.getFavorites(userId);
    }

    @PostMapping("/{userId}/toggle")
    public FavoritesResponse toggleFavorite(
            @PathVariable Long userId,
            @RequestBody ToggleFavoriteRequest request) {
        return favoriteService.toggleFavorite(userId, request.symbol());
    }
}
