package dev.emit.tenant.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.tenant.domain.Tenant;
import io.swagger.v3.oas.annotations.media.Schema;

public record TenantResponse(
        UUID id,
        @Schema(description = "Human-readable tenant name", example = "Acme Corp")
        String name,
        @Schema(description = "PostgreSQL schema holding this tenant's data", example = "acme_corp")
        String schemaName,
        @Schema(description = "Whether the tenant's API key is accepted")
        boolean active,
        @Schema(example = "2026-01-15T10:30:00Z")
        OffsetDateTime createdAt) {

    public static TenantResponse from(Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getSchemaName(),
                tenant.isActive(),
                tenant.getCreatedAt());
    }
}
