package dev.emit.tenant.adapter.out;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import dev.emit.shared.multitenancy.TenantSchemaValidator;
import dev.emit.tenant.application.SchemaProvisioner;
import dev.emit.tenant.domain.SchemaProvisioningException;
import liquibase.exception.LiquibaseException;
import liquibase.integration.spring.SpringLiquibase;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
class TenantProvisioner implements SchemaProvisioner {

    private static final Logger log = LoggerFactory.getLogger(TenantProvisioner.class);

    private final DataSource dataSource;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Override
    public void provision(String schemaName) {
        createSchema(schemaName);
        runMigrations(schemaName);
    }

    private void createSchema(String schemaName) {
        TenantSchemaValidator.validate(schemaName);
        log.info("Creating schema: {}", schemaName);
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA IF NOT EXISTS " + schemaName);
            statement.execute("GRANT ALL ON SCHEMA " + schemaName + " TO " + dbUsername);
            log.info("Schema created: {}", schemaName);
        } catch (SQLException exception) {
            throw new SchemaProvisioningException("Failed to create schema: " + schemaName, exception);
        }
    }

    /*
     * One Liquibase run at a time in this process. Liquibase keeps its scope
     * manager in an InheritableThreadLocal, so request threads share the main
     * thread's manager, and two runs at once corrupt its scope stack ("Cannot
     * end scope X when currently at scope Y"): a tenant registering while the
     * startup runner migrates the existing ones, or two registering together.
     * Static because the shared state is the process's, not this instance's.
     * Across instances nothing is shared, and each schema's own
     * DATABASECHANGELOGLOCK already guards it.
     */
    private static final Lock MIGRATION_LOCK = new ReentrantLock();

    void runMigrations(String schemaName) {
        log.info("Running migrations for schema: {}", schemaName);
        MIGRATION_LOCK.lock();
        try {
            SpringLiquibase liquibase = new SpringLiquibase();
            liquibase.setDataSource(dataSource);
            liquibase.setChangeLog("classpath:db/changelog/tenant/master.xml");
            liquibase.setDefaultSchema(schemaName);
            liquibase.setLiquibaseSchema(schemaName);
            liquibase.afterPropertiesSet();
            log.info("Migrations completed for schema: {}", schemaName);
        } catch (LiquibaseException exception) {
            throw new SchemaProvisioningException("Failed to migrate schema: " + schemaName, exception);
        } finally {
            MIGRATION_LOCK.unlock();
        }
    }
}
