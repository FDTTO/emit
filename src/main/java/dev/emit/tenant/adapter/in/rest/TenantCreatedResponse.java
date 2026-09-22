package dev.emit.tenant.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.tenant.domain.Tenant;
import io.swagger.v3.oas.annotations.media.Schema;

public record TenantCreatedResponse(
        UUID id,
        @Schema(description = "Human-readable tenant name", example = "Acme Corp")
        String name,
        @Schema(description = "PostgreSQL schema holding this tenant's data", example = "acme_corp")
        String schemaName,
        @Schema(description = "Whether the tenant's API key is accepted")
        boolean active,
        @Schema(example = "2026-01-15T10:30:00Z")
        OffsetDateTime createdAt,
        @Schema(
                description = "Raw API key. Returned exactly once; store it securely immediately.",
                example = "a3f8c2e1d4b796f0e5d3c2b1a0f9e8d7")
        String apiKey) {

    public static TenantCreatedResponse from(Tenant tenant, String apiKey) {
        return new TenantCreatedResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getSchemaName(),
                tenant.isActive(),
                tenant.getCreatedAt(),
                apiKey);
    }
}
