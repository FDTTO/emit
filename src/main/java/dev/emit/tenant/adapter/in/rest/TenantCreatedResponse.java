package dev.emit.tenant.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.tenant.domain.Tenant;
import io.swagger.v3.oas.annotations.media.Schema;

public record TenantCreatedResponse(
        UUID id,
        String name,
        String schemaName,
        boolean active,
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
