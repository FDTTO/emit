package dev.emit.shared.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @Schema(description = "Admin username", example = "admin")
        @NotBlank String username,
        @Schema(description = "Admin password", example = "admin123")
        @NotBlank String password) {
}
