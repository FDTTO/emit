package dev.emit.infrastructure.multitenancy;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import javax.sql.DataSource;

import org.springframework.stereotype.Component;

import liquibase.exception.LiquibaseException;
import liquibase.integration.spring.SpringLiquibase;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class TenantProvisioner {

    private final DataSource dataSource;

    public void provision(String schemaName) {
        createSchema(schemaName);
        runMigrations(schemaName);
    }

    private void createSchema(String schemaName) {
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA IF NOT EXISTS " + schemaName);
            statement.execute("GRANT ALL ON SCHEMA " + schemaName + " TO emit_user");
        } catch (SQLException exception) {
            throw new RuntimeException("Failed to create schema: " + schemaName, exception);
        }
    }

    public void runMigrations(String schemaName) {
        try {
            SpringLiquibase liquibase = new SpringLiquibase();
            liquibase.setDataSource(dataSource);
            liquibase.setChangeLog("classpath:db/changelog/tenant/master.xml");
            liquibase.setDefaultSchema(schemaName);
            liquibase.setLiquibaseSchema(schemaName);
            liquibase.afterPropertiesSet();
        } catch (LiquibaseException exception) {
            throw new RuntimeException("Failed to migrate schema: " + schemaName, exception);
        }
    }
}
