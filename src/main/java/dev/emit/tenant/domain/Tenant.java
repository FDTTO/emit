package dev.emit.tenant.domain;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(name = "tenants")
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "schema_name", nullable = false, unique = true)
    private String schemaName;

    @Column(name = "api_key_hash", nullable = false)
    private String apiKeyHash;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public static Tenant create(String name, String schemaName, String apiKeyHash) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Tenant name must not be blank");
        if (schemaName == null || schemaName.isBlank())
            throw new IllegalArgumentException("Schema name must not be blank");
        if (apiKeyHash == null || apiKeyHash.isBlank())
            throw new IllegalArgumentException("API key hash must not be blank");

        Tenant tenant = new Tenant();
        tenant.name = name;
        tenant.schemaName = schemaName;
        tenant.apiKeyHash = apiKeyHash;
        tenant.active = true;
        tenant.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        return tenant;
    }

    public void deactivate() {
        this.active = false;
    }

    public void reactivate() {
        this.active = true;
    }
}
