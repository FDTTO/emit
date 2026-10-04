package dev.emit.shared.web;

import java.io.FileNotFoundException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.stream.Collectors;

import dev.emit.document.application.GenerationNotQueuedException;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentPdfNotReadyException;
import dev.emit.document.domain.DocumentStatusException;
import dev.emit.shared.auth.InvalidCredentialsException;
import dev.emit.tenant.domain.TenantNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(400, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleConflict(DataIntegrityViolationException exception) {
        log.warn("Data integrity violation", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(
                        409, "Record already exists with the given data.", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(
                        400, "Request body is missing or malformed.", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        // Sorted, because the validator reports violations in no fixed order.
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(
                        400, message.isEmpty() ? "Invalid data." : message, OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler({DocumentNotFoundException.class, TenantNotFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(404, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(401, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(DocumentPdfNotReadyException.class)
    public ResponseEntity<ErrorResponse> handlePdfNotReady(DocumentPdfNotReadyException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(409, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(GenerationNotQueuedException.class)
    public ResponseEntity<ErrorResponse> handleNotQueued(GenerationNotQueuedException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse(503, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(DocumentStatusException.class)
    public ResponseEntity<ErrorResponse> handleDocumentStatus(DocumentStatusException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(409, exception.getMessage(), OffsetDateTime.now(ZoneOffset.UTC)));
    }

    /**
     * A URL that matches no handler and no static file is the caller's mistake.
     * Unclaimed, {@code NoResourceFoundException} falls to {@link #handleGeneric}
     * and every typo in a path becomes a 500 logged at ERROR.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(404, "Resource not found.", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    /**
     * A path value Spring could not convert, such as a document id that is not
     * a UUID. The caller sent something the route cannot accept, so it is a
     * 400 naming the value, not a 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        Class<?> required = exception.getRequiredType();
        String expected = required == null ? "the expected type" : required.getSimpleName();
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(
                        400,
                        "'" + exception.getName() + "' is not a valid " + expected + ".",
                        OffsetDateTime.now(ZoneOffset.UTC)));
    }

    /**
     * A static file served once and then removed: its cached handle reports a
     * {@link FileNotFoundException} instead of {@code NoResourceFoundException}.
     * Narrow on purpose: only under Spring's static resource handler is that a
     * 404. Anywhere else it is a file the server expected, such as a PDF
     * template or a font, and stays a 500.
     */
    @ExceptionHandler(FileNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMissingStaticResource(
            FileNotFoundException exception, HttpServletRequest request) {

        Object handler = request.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
        if (!(handler instanceof ResourceHttpRequestHandler)) {
            return handleGeneric(exception);
        }
        log.warn("Static resource vanished after it was first served: {}", request.getRequestURI());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(404, "Resource not found.", OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception exception) {
        log.error("Unhandled exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(500, "Internal server error.", OffsetDateTime.now(ZoneOffset.UTC)));
    }
}
