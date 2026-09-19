package dev.emit.tenant.adapter.in.rest;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTenantRequest(
        @Schema(description = "Human-readable tenant name", example = "Acme Corp")
        @NotBlank
        @Size(max = 100, message = "name must not exceed 100 characters")
        String name,
        @Schema(
                description = "PostgreSQL schema name. Must match [a-z][a-z0-9_]{1,62}: "
                        + "lowercase, starts with a letter, no hyphens, 2-63 chars.",
                example = "acme_corp")
        @NotBlank
        @Pattern(
                regexp = "^[a-z][a-z0-9_]{1,62}$",
                message = "schemaName must start with a lowercase letter and contain only lowercase letters, digits, and underscores, between 2 and 63 characters")
        String schemaName) {
}
