package dev.emit.tenant.adapter.out;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import dev.emit.tenant.domain.TenantRepository;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class TenantMigrationsRunner implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(TenantMigrationsRunner.class);

    private final TenantRepository tenantRepository;
    private final TenantProvisioner tenantProvisioner;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("Running pending migrations on all tenant schemas...");
        tenantRepository.findAll().forEach(tenant -> {
            log.info("Migrating schema: {}", tenant.getSchemaName());
            tenantProvisioner.runMigrations(tenant.getSchemaName());
        });
        log.info("Tenant migrations completed.");
    }
}
