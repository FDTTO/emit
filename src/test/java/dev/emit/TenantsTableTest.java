package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The public tenants table as the changelog builds it, read from PostgreSQL itself. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TenantsTableTest extends ContainerizedTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void shouldRefuseASecondTenantWithTheSameApiKeyHash() {
        String hash = "hash-" + UUID.randomUUID();
        insertTenant(hash);

        assertThatThrownBy(() -> insertTenant(hash)).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void shouldIndexEachLookupColumnOnce() {
        List<String> indexes = jdbcTemplate.queryForList(
                "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'tenants'"
                        + " ORDER BY indexname",
                String.class);

        assertThat(indexes)
                .containsExactly(
                        "tenants_api_key_hash_key", "tenants_name_key", "tenants_pkey", "tenants_schema_name_key");
    }

    private void insertTenant(String apiKeyHash) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbcTemplate.update(
                "INSERT INTO public.tenants (id, name, schema_name, api_key_hash) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(),
                "table-test-" + suffix,
                "table_test_" + suffix,
                apiKeyHash);
    }
}
