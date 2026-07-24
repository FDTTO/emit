package dev.emit.presentation.rest.tenant;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.domain.tenant.Tenant;

public record TenantCreatedResponse(
        UUID id,
        String name,
        String schemaName,
        boolean active,
        OffsetDateTime createdAt,
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
