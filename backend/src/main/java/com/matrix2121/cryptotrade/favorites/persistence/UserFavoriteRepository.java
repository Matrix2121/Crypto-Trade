package com.matrix2121.cryptotrade.favorites.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {

    List<UserFavorite> findByUserIdOrderBySortOrderAsc(Long userId);

    Optional<UserFavorite> findByUserIdAndSymbol(Long userId, String symbol);

    void deleteByUserIdAndSymbol(Long userId, String symbol);

    @Query("SELECT COALESCE(MAX(f.sortOrder), 0) FROM UserFavorite f WHERE f.userId = :userId")
    Integer findMaxSortOrderByUserId(@Param("userId") Long userId);
}
