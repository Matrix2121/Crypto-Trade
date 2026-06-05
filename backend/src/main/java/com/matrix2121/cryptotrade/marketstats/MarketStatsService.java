package com.matrix2121.cryptotrade.marketstats;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.matrix2121.cryptotrade.marketdata.TrackedSymbolsService;
import com.matrix2121.cryptotrade.marketstats.dto.TrackedAssetDto;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAsset;
import com.matrix2121.cryptotrade.marketstats.persistence.TrackedAssetRepository;

@Service
public class MarketStatsService {

    private final TrackedAssetRepository trackedAssetRepository;
    private final MarketStatsEnrichmentService enrichmentService;
    private final TrackedSymbolsService trackedSymbolsService;

    public MarketStatsService(
            TrackedAssetRepository trackedAssetRepository,
            MarketStatsEnrichmentService enrichmentService,
            TrackedSymbolsService trackedSymbolsService) {
        this.trackedAssetRepository = trackedAssetRepository;
        this.enrichmentService = enrichmentService;
        this.trackedSymbolsService = trackedSymbolsService;
    }

    public List<TrackedAssetDto> getAllTrackedAssets() {
        Map<String, TrackedAsset> bySymbol = trackedAssetRepository.findAll().stream()
                .collect(Collectors.toMap(TrackedAsset::getSymbol, Function.identity()));

        return trackedSymbolsService.getSymbols().stream()
                .map(symbol -> {
                    TrackedAsset asset = bySymbol.get(symbol);
                    TrackedAssetDto dto = asset != null
                            ? TrackedAssetDto.from(asset)
                            : TrackedAssetDto.empty(symbol);
                    return enrich(dto);
                })
                .toList();
    }

    public Optional<TrackedAssetDto> getTrackedAsset(String pathSymbol) {
        return trackedSymbolsService.resolveFromPath(pathSymbol)
                .map(symbol -> {
                    TrackedAssetDto dto = trackedAssetRepository.findById(symbol)
                            .map(TrackedAssetDto::from)
                            .orElseGet(() -> TrackedAssetDto.empty(symbol));
                    return enrich(dto);
                });
    }

    private TrackedAssetDto enrich(TrackedAssetDto dto) {
        Double change24h = enrichmentService.resolveChange24h(dto.symbol(), dto.change24h());
        if (Objects.equals(change24h, dto.change24h())) {
            return dto;
        }
        return new TrackedAssetDto(
                dto.symbol(),
                dto.marketRank(),
                dto.marketCap(),
                dto.circulatingSupply(),
                dto.allTimeHigh(),
                dto.athTimestamp(),
                change24h,
                dto.volume24h());
    }
}
