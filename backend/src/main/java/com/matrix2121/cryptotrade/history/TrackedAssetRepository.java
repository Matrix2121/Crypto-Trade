package com.matrix2121.cryptotrade.history;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrackedAssetRepository extends JpaRepository<TrackedAsset, String> {
}
