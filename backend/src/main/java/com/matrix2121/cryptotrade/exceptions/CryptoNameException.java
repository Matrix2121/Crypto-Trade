package com.matrix2121.cryptotrade.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(value = HttpStatus.NOT_FOUND)
public class CryptoNameException extends RuntimeException {
    public CryptoNameException(String message) {
        super(message);
    }
}
