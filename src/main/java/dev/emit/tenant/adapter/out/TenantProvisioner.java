package dev.emit.tenant.adapter.out;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

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

    void runMigrations(String schemaName) {
        log.info("Running migrations for schema: {}", schemaName);
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
        }
    }
}
