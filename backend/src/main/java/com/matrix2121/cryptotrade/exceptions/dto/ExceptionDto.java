package com.matrix2121.cryptotrade.exceptions.dto;

import java.util.Date;

public record ExceptionDto(
        Date timestamp,
        String message,
        String details) {
}