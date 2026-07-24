package dev.emit.presentation.rest.tenant;

import jakarta.validation.constraints.NotBlank;

public record CreateTenantRequest(
        @NotBlank String name,
        @NotBlank String schemaName) {
}
