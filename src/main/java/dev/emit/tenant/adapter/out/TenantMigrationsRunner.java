package dev.emit.tenant.adapter.out;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.stereotype.Component;

import dev.emit.tenant.domain.TenantRepository;
import lombok.RequiredArgsConstructor;

/**
 * Brings every tenant schema up to date with the changelog at startup.
 *
 * <p>It runs as a {@link SmartInitializingSingleton}, once the context has
 * built its singletons and before the web server accepts connections. An
 * ApplicationReadyEvent listener would run after the port is open, leaving a
 * window where a tenant is served from a schema the code no longer matches.
 * A failure here stops the application from starting, which is the intended
 * outcome: serving a stale schema is worse than not serving.
 */
@Component
@RequiredArgsConstructor
public class TenantMigrationsRunner implements SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(TenantMigrationsRunner.class);

    private final TenantRepository tenantRepository;
    private final TenantProvisioner tenantProvisioner;

    private volatile boolean completed;

    @Override
    public void afterSingletonsInstantiated() {
        log.info("Running pending migrations on all tenant schemas...");
        tenantRepository.findAll().forEach(tenant -> {
            log.info("Migrating schema: {}", tenant.getSchemaName());
            tenantProvisioner.runMigrations(tenant.getSchemaName());
        });
        completed = true;
        log.info("Tenant migrations completed.");
    }

    /** Whether every tenant schema is migrated, and so safe to serve. */
    public boolean hasCompleted() {
        return completed;
    }
}
