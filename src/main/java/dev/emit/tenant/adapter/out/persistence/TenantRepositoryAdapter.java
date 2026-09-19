package dev.emit.tenant.adapter.out.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import dev.emit.tenant.domain.Tenant;
import dev.emit.tenant.domain.TenantRepository;

interface TenantRepositoryAdapter extends JpaRepository<Tenant, UUID>, TenantRepository {
}
