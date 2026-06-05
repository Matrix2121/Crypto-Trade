package com.matrix2121.cryptotrade.exceptions;

public class KrakenApiException extends RuntimeException {

    public KrakenApiException(String message) {
        super(message);
    }

    public KrakenApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
