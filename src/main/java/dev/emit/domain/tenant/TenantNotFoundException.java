package dev.emit.domain.tenant;

import java.util.UUID;

public class TenantNotFoundException extends RuntimeException {

    public TenantNotFoundException(UUID id) {
        super("Tenant not found: " + id);
    }
}
