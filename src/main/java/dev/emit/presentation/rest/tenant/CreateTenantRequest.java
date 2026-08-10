package dev.emit.presentation.rest.tenant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateTenantRequest(
        @NotBlank String name,
        @NotBlank @Pattern(
                regexp = "^[a-z][a-z0-9_]{1,62}$",
                message = "schemaName must be a valid PostgreSQL identifier: lowercase letters, digits and underscores only, starting with a letter, 2-63 characters") String schemaName) {
}
