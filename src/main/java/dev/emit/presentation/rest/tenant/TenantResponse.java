package dev.emit.presentation.rest.tenant;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TenantResponse(
        UUID id,
        String name,
        String schemaName,
        boolean active,
        OffsetDateTime createdAt) {
    public static TenantResponse from(dev.emit.domain.tenant.Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getSchemaName(),
                tenant.isActive(),
                tenant.getCreatedAt());
    }
}
