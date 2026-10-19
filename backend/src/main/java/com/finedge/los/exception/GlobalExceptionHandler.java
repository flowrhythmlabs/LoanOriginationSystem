package com.finedge.los.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        ApiError apiError = new ApiError(Instant.now(), HttpStatus.BAD_REQUEST.value(), "Validation failed", request.getRequestURI(), errors);
        return ResponseEntity.badRequest().body(apiError);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.BAD_REQUEST.value(), ex.getMessage(), request.getRequestURI(), null);
        return ResponseEntity.badRequest().body(apiError);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        String message = request.getRequestURI().contains("/documents") && ex.getMessage().startsWith("Application not found")
                ? "Application not found. Please save the application before uploading documents."
                : ex.getMessage();
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.NOT_FOUND.value(), message, request.getRequestURI(), null);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(apiError);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.BAD_REQUEST.value(), ex.getMessage(), request.getRequestURI(), null);
        return ResponseEntity.badRequest().body(apiError);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        logger.error("Multipart upload exceeded configured limit: path={} requestSize={} contentType={} exceptionClass={} exceptionMessage={}",
            request.getRequestURI(), request.getContentLengthLong(), request.getContentType(), ex.getClass().getName(), ex.getMessage(), ex);
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.PAYLOAD_TOO_LARGE.value(), "File size exceeds the 10 MB limit.", request.getRequestURI(), null);
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(apiError);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiError> handleMultipartException(MultipartException ex, HttpServletRequest request) {
        logger.error("Multipart request could not be parsed: path={} requestSize={} contentType={} exceptionClass={} exceptionMessage={}",
            request.getRequestURI(), request.getContentLengthLong(), request.getContentType(), ex.getClass().getName(), ex.getMessage(), ex);
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.BAD_REQUEST.value(), "Invalid multipart upload request.", request.getRequestURI(), null);
        return ResponseEntity.badRequest().body(apiError);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingRequestParameter(MissingServletRequestParameterException ex, HttpServletRequest request) {
        if (request.getRequestURI().contains("/documents")) {
            logger.error("Document upload request is missing a required field: path={} requestSize={} contentType={} exceptionClass={} exceptionMessage={}",
                    request.getRequestURI(), request.getContentLengthLong(), request.getContentType(), ex.getClass().getName(), ex.getMessage(), ex);
        }
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.BAD_REQUEST.value(), ex.getParameterName() + " is required.", request.getRequestURI(), null);
        return ResponseEntity.badRequest().body(apiError);
    }

    @ExceptionHandler(DocumentStorageException.class)
    public ResponseEntity<ApiError> handleDocumentStorage(DocumentStorageException ex, HttpServletRequest request) {
        logger.error("Document storage failed for request {}", request.getRequestURI(), ex);
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.INTERNAL_SERVER_ERROR.value(), "Document upload failed. Please try again.", request.getRequestURI(), null);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(apiError);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneralException(Exception ex, HttpServletRequest request) {
        logger.error("Unhandled exception processing {} {}", request.getMethod(), request.getRequestURI(), ex);
        ApiError apiError = new ApiError(Instant.now(), HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal server error", request.getRequestURI(), null);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(apiError);
    }

    public static class ApiError {
        private Instant timestamp;
        private int status;
        private String message;
        private String path;
        private Object errors;

        public ApiError(Instant timestamp, int status, String message, String path, Object errors) {
            this.timestamp = timestamp;
            this.status = status;
            this.message = message;
            this.path = path;
            this.errors = errors;
        }

        public Instant getTimestamp() { return timestamp; }
        public int getStatus() { return status; }
        public String getMessage() { return message; }
        public String getPath() { return path; }
        public Object getErrors() { return errors; }
    }
}
