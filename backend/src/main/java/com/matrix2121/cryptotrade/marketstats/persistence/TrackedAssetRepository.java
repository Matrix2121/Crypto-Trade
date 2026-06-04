package com.matrix2121.cryptotrade.marketstats.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackedAssetRepository extends JpaRepository<TrackedAsset, String> {
}
