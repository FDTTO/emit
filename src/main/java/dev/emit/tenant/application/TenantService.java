package dev.emit.tenant.application;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dev.emit.shared.multitenancy.ApiKeyHasher;
import dev.emit.tenant.domain.Tenant;
import dev.emit.tenant.domain.TenantNotFoundException;
import dev.emit.tenant.domain.TenantRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TenantRepository tenantRepository;
    private final SchemaProvisioner schemaProvisioner;

    @Transactional(readOnly = true)
    public List<Tenant> listAll() {
        return tenantRepository.findAll();
    }

    @Transactional
    public TenantCreated create(String name, String schemaName) {
        String apiKey = generateApiKey();
        String apiKeyHash = ApiKeyHasher.hash(apiKey);

        Tenant tenant = Tenant.create(name, schemaName, apiKeyHash);

        Tenant saved = tenantRepository.save(tenant);
        schemaProvisioner.provision(schemaName);

        log.info("Tenant created tenantId={} schemaName={}", saved.getId(), schemaName);
        return new TenantCreated(saved, apiKey);
    }

    private String generateApiKey() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return ApiKeyHasher.toHexString(bytes);
    }

    @Transactional(readOnly = true)
    public Tenant findById(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new TenantNotFoundException(id));
    }

    @Transactional
    public void deactivate(UUID id) {
        Tenant tenant = findById(id);
        tenant.deactivate();
        tenantRepository.save(tenant);
        log.info("Tenant deactivated tenantId={}", id);
    }

    @Transactional
    public void reactivate(UUID id) {
        Tenant tenant = findById(id);
        tenant.reactivate();
        tenantRepository.save(tenant);
        log.info("Tenant reactivated tenantId={}", id);
    }

    public record TenantCreated(Tenant tenant, String apiKey) {
    }
}
