package com.matrix2121.cryptotrade.predictions;

import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
public class PredictionReadService {

    private final PredictionRepository predictionRepository;
    private final PredictionResponseMapper responseMapper;
    private final ObjectMapper objectMapper;

    public PredictionReadService(
            PredictionRepository predictionRepository,
            PredictionResponseMapper responseMapper,
            ObjectMapper objectMapper) {
        this.predictionRepository = predictionRepository;
        this.responseMapper = responseMapper;
        this.objectMapper = objectMapper;
    }

    public ObjectNode getLatest(String asset) {
        Optional<PredictionRow> hourly = predictionRepository.findLatestHourly(asset);
        Optional<PredictionRow> daily = predictionRepository.findLatestDaily(asset);

        if (hourly.isEmpty() && daily.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No predictions found for " + asset);
        }

        PredictionRow merged;
        if (daily.isPresent() && hourly.isPresent()) {
            merged = daily.get().withHourlyOverlay(hourly.get());
        } else if (hourly.isPresent()) {
            merged = hourly.get();
        } else {
            merged = daily.get();
        }

        return responseMapper.toResponse(merged);
    }

    public ArrayNode getHistory(String asset, int limit) {
        List<PredictionRow> rows = predictionRepository.findHistory(asset, limit);
        ArrayNode result = objectMapper.createArrayNode();
        for (PredictionRow row : rows) {
            result.add(responseMapper.toResponse(row));
        }
        return result;
    }
}
