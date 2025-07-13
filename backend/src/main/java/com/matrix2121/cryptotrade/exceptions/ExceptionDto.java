package com.matrix2121.cryptotrade.exceptions;

import java.util.Date;

public record ExceptionDto(
        Date timestamp,
        String message,
        String details) {
}