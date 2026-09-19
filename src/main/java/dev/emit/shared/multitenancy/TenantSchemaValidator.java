package dev.emit.shared.multitenancy;

import java.util.regex.Pattern;

public final class TenantSchemaValidator {

    private static final Pattern VALID_SCHEMA = Pattern.compile("^[a-z][a-z0-9_]{1,62}$");

    private TenantSchemaValidator() {
    }

    public static void validate(String schemaName) {
        if (schemaName == null || (!VALID_SCHEMA.matcher(schemaName).matches() && !schemaName.equals("public"))) {
            throw new IllegalArgumentException("Invalid schema name: " + schemaName);
        }
    }
}
