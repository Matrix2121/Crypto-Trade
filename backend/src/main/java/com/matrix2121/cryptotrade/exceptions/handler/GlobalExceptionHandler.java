package com.matrix2121.cryptotrade.exceptions.handler;

import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

import com.matrix2121.cryptotrade.exceptions.dto.ExceptionDto;
import com.matrix2121.cryptotrade.exceptions.*;

import java.util.Date;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ExceptionDto> handleUserNotFoundException(UserNotFoundException ex, WebRequest request) {
        ExceptionDto exceptionDto = new ExceptionDto(new Date(), ex.getMessage(), request.getDescription(false));
        return new ResponseEntity<>(exceptionDto, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(NoAssetsException.class)
    public ResponseEntity<ExceptionDto> handleNoAssetsException(NoAssetsException ex, WebRequest request) {
        ExceptionDto exceptionDto = new ExceptionDto(new Date(), ex.getMessage(), request.getDescription(false));
        return new ResponseEntity<>(exceptionDto, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(NoTransasctionsException.class)
    public ResponseEntity<ExceptionDto> handleNoTransasctionsException(NoTransasctionsException ex, WebRequest request) {
        ExceptionDto exceptionDto = new ExceptionDto(new Date(), ex.getMessage(), request.getDescription(false));
        return new ResponseEntity<>(exceptionDto, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ExceptionDto> handleDataAccessException(DataAccessException ex, WebRequest request) {
        return(dataBaseExceptionHandler(ex, request));
    }

    private ResponseEntity<ExceptionDto> dataBaseExceptionHandler(DataAccessException ex, WebRequest request){
        Throwable rootCause = ex.getMostSpecificCause();
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        String cleanMessage = "A database error occurred.";

        if (rootCause instanceof PSQLException psqlEx) {
            ServerErrorMessage serverError = psqlEx.getServerErrorMessage();
            if (serverError != null && serverError.getMessage() != null) {
                cleanMessage = serverError.getMessage();
            }
        } else if (rootCause != null) {
             String fullMessage = rootCause.getMessage();
             if (fullMessage != null) {
                cleanMessage = fullMessage.split("\n")[0];
             }
        }

        if (cleanMessage.startsWith("Insufficient funds") || cleanMessage.startsWith("Insufficient crypto")) {
            status = HttpStatus.BAD_REQUEST;
        } else if (cleanMessage.contains("not found")) {
            status = HttpStatus.NOT_FOUND;
        } else if (cleanMessage.contains("must be positive")) {
            status = HttpStatus.BAD_REQUEST;
        }

        ExceptionDto errorDetails = new ExceptionDto(new Date(), cleanMessage, request.getDescription(false));
        return new ResponseEntity<>(errorDetails, status);
    }
}
