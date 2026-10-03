package dev.emit.tenant.adapter.out.persistence;

import java.util.UUID;

import dev.emit.tenant.domain.Tenant;
import dev.emit.tenant.domain.TenantRepository;
import org.springframework.data.jpa.repository.JpaRepository;

interface TenantRepositoryAdapter extends JpaRepository<Tenant, UUID>, TenantRepository {}
