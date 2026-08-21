package dev.emit.infrastructure.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApiKeyHasherTest {

    @Test
    void hashShouldBeDeterministic() {
        String key = "my-api-key-123";

        assertThat(ApiKeyHasher.hash(key)).isEqualTo(ApiKeyHasher.hash(key));
    }

    @Test
    void hashShouldProduceLowercaseHex64Chars() {
        String hash = ApiKeyHasher.hash("any-key");

        assertThat(hash).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void differentKeysShouldProduceDifferentHashes() {
        assertThat(ApiKeyHasher.hash("key-one")).isNotEqualTo(ApiKeyHasher.hash("key-two"));
    }
}
