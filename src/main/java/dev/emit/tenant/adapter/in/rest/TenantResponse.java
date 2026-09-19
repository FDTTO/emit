package dev.emit.tenant.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.tenant.domain.Tenant;

public record TenantResponse(
        UUID id,
        String name,
        String schemaName,
        boolean active,
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
