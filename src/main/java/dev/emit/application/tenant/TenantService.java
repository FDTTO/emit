package dev.emit.application.tenant;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import dev.emit.domain.tenant.Tenant;
import dev.emit.domain.tenant.TenantNotFoundException;
import dev.emit.domain.tenant.TenantRepository;
import dev.emit.infrastructure.multitenancy.ApiKeyHasher;
import dev.emit.infrastructure.multitenancy.TenantProvisioner;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;
    private final TenantProvisioner tenantProvisioner;

    public List<Tenant> listAll() {
        return tenantRepository.findAll();
    }

    @Transactional
    public TenantCreated create(String name, String schemaName) {
        String apiKey = generateApiKey();
        String apiKeyHash = ApiKeyHasher.hash(apiKey);

        Tenant tenant = new Tenant();
        tenant.setName(name);
        tenant.setSchemaName(schemaName);
        tenant.setApiKeyHash(apiKeyHash);
        tenant.setActive(true);
        tenant.setCreatedAt(OffsetDateTime.now());

        Tenant saved = tenantRepository.save(tenant);
        tenantProvisioner.provision(schemaName);
        return new TenantCreated(saved, apiKey);
    }

    private String generateApiKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        StringBuilder stringBuilder = new StringBuilder();
        for (byte b : bytes) {
            stringBuilder.append(String.format("%02x", b));
        }
        return stringBuilder.toString();
    }

    public Tenant findById(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new TenantNotFoundException(id));
    }

    public record TenantCreated(Tenant tenant, String apikey) {
    }
}
