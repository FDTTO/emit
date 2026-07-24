package dev.emit.infrastructure.multitenancy;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import dev.emit.domain.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class TenantMigrationsRunner implements ApplicationListener<ApplicationReadyEvent> {

    private final TenantRepository tenantRepository;
    private final TenantProvisioner tenantProvisioner;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("Executando migrations pendentes em todos os schemas de Tenant...");
        tenantRepository.findAll().forEach(tenant -> {
            log.info("Migrando schema: {}", tenant.getSchemaName());
            tenantProvisioner.runMigrations(tenant.getSchemaName());
        });
        log.info("Migrations de Tenant concluídas!");
    }

}
