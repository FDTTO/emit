package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;

import dev.emit.tenant.adapter.out.TenantMigrationsRunner;

/**
 * Tenant schemas must be migrated before the application accepts a request.
 * Migrating after startup leaves a window in which a tenant is served from a
 * schema the code no longer matches.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TenantMigrationsStartupTest extends ContainerizedTest {

    static final AtomicBoolean MIGRATED_BEFORE_SERVING = new AtomicBoolean();

    @TestConfiguration
    static class ServerStartRecorder {

        @Bean
        ApplicationListener<WebServerInitializedEvent> recordMigrationState(TenantMigrationsRunner runner) {
            return event -> MIGRATED_BEFORE_SERVING.set(runner.hasCompleted());
        }
    }

    @Test
    void shouldMigrateTenantSchemasBeforeTheServerAcceptsRequests() {
        assertThat(MIGRATED_BEFORE_SERVING).isTrue();
    }
}
