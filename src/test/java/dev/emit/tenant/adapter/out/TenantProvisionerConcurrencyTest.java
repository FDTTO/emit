package dev.emit.tenant.adapter.out;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import liquibase.Scope;

@Testcontainers
class TenantProvisionerConcurrencyTest {

    @SuppressWarnings("resource")
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    /*
     * Liquibase keeps its scope manager in an InheritableThreadLocal: a thread
     * inherits the very same manager instance as the thread that created it.
     * In the app, the main thread has used Liquibase by the time request
     * threads exist (the public schema migrates at startup), so every request
     * thread shares main's manager. Two migrations at once on that shared
     * manager corrupt its scope stack ("Cannot end scope X when currently at
     * scope Y"): a tenant registering while the startup runner migrates the
     * existing ones, or two registering together.
     *
     * The first line reproduces that inheritance. Without it each worker
     * thread builds its own manager and the race cannot happen.
     */
    @Test
    void concurrentProvisioningCompletesForEverySchema() throws Exception {
        Scope.getCurrentScope();
        DataSource dataSource = new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        TenantProvisioner provisioner = new TenantProvisioner(dataSource);
        ReflectionTestUtils.setField(provisioner, "dbUsername", postgres.getUsername());

        List<String> schemas = IntStream.range(0, 6).mapToObj(i -> "concurrent_" + i).toList();
        ExecutorService pool = Executors.newFixedThreadPool(schemas.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> runs = schemas.stream()
                    .<Future<?>>map(schema -> pool.submit(() -> {
                        start.await();
                        provisioner.provision(schema);
                        return null;
                    }))
                    .toList();
            start.countDown();
            for (Future<?> run : runs) {
                run.get(90, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
            for (String schema : schemas) {
                ResultSet tables = statement.executeQuery(
                        "SELECT count(*) FROM information_schema.tables"
                                + " WHERE table_schema = '" + schema + "' AND table_name = 'documents'");
                tables.next();
                assertThat(tables.getInt(1)).as("documents table in %s", schema).isEqualTo(1);
            }
        }
    }
}
