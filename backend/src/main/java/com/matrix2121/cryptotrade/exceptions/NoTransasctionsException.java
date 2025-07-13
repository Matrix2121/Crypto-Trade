package com.matrix2121.cryptotrade.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(value = HttpStatus.NOT_FOUND)
public class NoTransasctionsException extends RuntimeException {
    public NoTransasctionsException(String message) {
        super(message);
    }
}
