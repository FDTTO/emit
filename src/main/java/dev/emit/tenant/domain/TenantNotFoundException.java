package dev.emit.tenant.domain;

import java.util.UUID;

public class TenantNotFoundException extends RuntimeException {

    public TenantNotFoundException(UUID id) {
        super("Tenant not found: " + id);
    }
}
