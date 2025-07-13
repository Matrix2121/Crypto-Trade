package com.matrix2121.cryptotrade.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

import java.util.Date;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ExceptionDto> handleUserNotFoundException(UserNotFoundException ex, WebRequest request) {
        ExceptionDto exceptionDto = new ExceptionDto(new Date(), ex.getMessage(), request.getDescription(false));
        return new ResponseEntity<>(exceptionDto, HttpStatus.NOT_FOUND);
    }
}
