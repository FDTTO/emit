package dev.emit.shared.multitenancy;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TenantSchemaValidatorTest {

    @Test
    void shouldAcceptValidSchemaName() {
        assertThatCode(() -> TenantSchemaValidator.validate("acme_corp")).doesNotThrowAnyException();
    }

    @Test
    void shouldAcceptPublicSchemaName() {
        assertThatCode(() -> TenantSchemaValidator.validate("public")).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectNullSchemaName() {
        assertThatThrownBy(() -> TenantSchemaValidator.validate(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectSingleCharSchemaName() {
        assertThatThrownBy(() -> TenantSchemaValidator.validate("a"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectSchemaNameStartingWithDigit() {
        assertThatThrownBy(() -> TenantSchemaValidator.validate("1invalid"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectSchemaNameWithUppercase() {
        assertThatThrownBy(() -> TenantSchemaValidator.validate("AcmeCorp"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRejectSchemaNameWithHyphen() {
        assertThatThrownBy(() -> TenantSchemaValidator.validate("acme-corp"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
