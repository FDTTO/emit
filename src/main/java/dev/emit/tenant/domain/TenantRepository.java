package dev.emit.tenant.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository {
    Optional<Tenant> findById(UUID id);
    Tenant save(Tenant tenant);
    List<Tenant> findAll();
    Optional<Tenant> findByApiKeyHash(String apiKeyHash);
}
