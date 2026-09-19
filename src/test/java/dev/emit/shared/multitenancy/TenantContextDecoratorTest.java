package dev.emit.shared.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

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
    void shouldSetTenantContextBeforeRunning() {
        String[] captured = new String[1];

        decorator.run("acme_corp", Map.of(), () -> captured[0] = TenantContext.getTenant());

        assertThat(captured[0]).isEqualTo("acme_corp");
    }

    @Test
    void shouldPopulateMdcBeforeRunning() {
        String[] captured = new String[1];

        decorator.run("acme_corp", Map.of("tenantSchema", "acme_corp"), () -> captured[0] = MDC.get("tenantSchema"));

        assertThat(captured[0]).isEqualTo("acme_corp");
    }

    @Test
    void shouldClearTenantContextAfterSuccess() {
        decorator.run("acme_corp", Map.of(), () -> {});

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void shouldClearTenantContextAfterException() {
        assertThatThrownBy(() -> decorator.run("acme_corp", Map.of(), () -> {
            throw new RuntimeException("boom");
        })).isInstanceOf(RuntimeException.class);

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void shouldClearMdcAfterException() {
        assertThatThrownBy(() -> decorator.run("acme_corp", Map.of("tenantSchema", "acme_corp"), () -> {
            throw new RuntimeException("boom");
        })).isInstanceOf(RuntimeException.class);

        assertThat(MDC.get("tenantSchema")).isNull();
    }
}
