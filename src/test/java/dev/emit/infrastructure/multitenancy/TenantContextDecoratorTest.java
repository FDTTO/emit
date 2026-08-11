package dev.emit.infrastructure.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

class TenantContextDecoratorTest {

    private final TenantContextDecorator decorator = new TenantContextDecorator();

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        MDC.clear();
    }

    @Test
    void shouldPropagateTenantContextToDecoratedRunnable() {
        TenantContext.setTenant("tenant_abc");
        var capturedTenant = new AtomicReference<String>();

        Runnable decorated = decorator.decorate(() -> capturedTenant.set(TenantContext.getTenant()));
        decorated.run();

        assertThat(capturedTenant.get()).isEqualTo("tenant_abc");
    }

    @Test
    void shouldPropagateMdcToDecoratedRunnable() {
        MDC.put("requestId", "req-123");
        MDC.put("tenantSchema", "tenant_abc");
        var capturedRequestId = new AtomicReference<String>();
        var capturedSchema = new AtomicReference<String>();

        Runnable decorated = decorator.decorate(() -> {
            capturedRequestId.set(MDC.get("requestId"));
            capturedSchema.set(MDC.get("tenantSchema"));
        });
        decorated.run();

        assertThat(capturedRequestId.get()).isEqualTo("req-123");
        assertThat(capturedSchema.get()).isEqualTo("tenant_abc");
    }

    @Test
    void shouldClearTenantContextAndMdcAfterRunnableCompletes() {
        TenantContext.setTenant("tenant_abc");
        MDC.put("requestId", "req-123");

        Runnable decorated = decorator.decorate(() -> {
        });
        decorated.run();

        assertThat(TenantContext.getTenant()).isNull();
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void shouldClearTenantContextAndMdcEvenWhenRunnableThrows() {
        TenantContext.setTenant("tenant_abc");
        MDC.put("requestId", "req-123");

        Runnable decorated = decorator.decorate(() -> {
            throw new RuntimeException("async failure");
        });

        try {
            decorated.run();
        } catch (RuntimeException ignored) {
        }

        assertThat(TenantContext.getTenant()).isNull();
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void shouldHandleNullMdcContext() {
        MDC.clear();
        TenantContext.setTenant("tenant_abc");
        var capturedTenant = new AtomicReference<String>();

        Runnable decorated = decorator.decorate(() -> capturedTenant.set(TenantContext.getTenant()));
        decorated.run();

        assertThat(capturedTenant.get()).isEqualTo("tenant_abc");
    }
}
