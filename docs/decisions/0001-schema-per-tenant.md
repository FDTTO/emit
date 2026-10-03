# 0001. Schema per tenant

*The boundary lives in the database, not in every query.*

## Context

With a `tenant_id` column on shared tables, isolation is a filter that every
repository method must remember. One method without it returns every
tenant's rows, with no exception and no log line. Row-level security moves
the filter into policies, and the failure moves with it: a new table
without a policy leaks the same way. Both depend on vigilance across every
migration and every query.

## Decision

Each tenant gets its own PostgreSQL schema. `SchemaMultiTenantConnectionProvider`
issues `SET search_path TO {schema}` on every connection checkout, from the
tenant the request or the Kafka event carries. A wrong or missing schema
resolves no tables at all, so a forgotten filter cannot exist: there is none.

The tenant reaches the connection provider through `TenantContext`, and only
inside a scope: `TenantFilter` opens one around the rest of the request,
`TenantContextDecorator` around each event, and closing it restores the
tenant that came before. A pooled thread cannot carry one request's tenant
into the next, which would be the same leak in another form, and no code
can set a tenant without the scope that takes it away. Java's `ScopedValue`
gives that guarantee by construction, but it binds around a lambda, and a
filter chain's two checked exceptions cannot pass through a generic lambda
without being folded into `Exception`; the scope keeps the filter's
signature exact with the same effect.

```
POST /v1/tenants
  ├── INSERT INTO public.tenants    (SHA-256 of the key; the raw key is returned once)
  ├── CREATE SCHEMA {schemaName}
  └── Liquibase update in {schemaName}: db/changelog/tenant/master.xml

Startup: TenantMigrationsRunner
  ├── SELECT schema_name FROM public.tenants
  └── Liquibase update in each, before the web server accepts a request
```

Tenant migrations run one at a time: Liquibase keeps its scope in an
inheritable thread-local, and concurrent runs in one JVM corrupted it
(`TenantProvisionerConcurrencyTest` holds this).

The repositories carry no tenant at all:

```java
// A tenant_id column: a filter on every query, and one missing leaks every tenant.
Optional<Document> findByIdAndTenantId(UUID id, UUID tenantId);

// EMIT: the schema is the boundary; the query does not know there are tenants.
Optional<Document> findById(UUID id);
```

## Consequences

- Provisioning a tenant creates a schema and runs its migrations, which
  takes a moment on the request that creates it.
- Every tenant adds objects to `pg_catalog`. That suits a B2B service with
  a bounded, known set of tenants; a consumer product with millions of
  users would be better served by row-level filtering.
- A schema change runs once per tenant, at startup and on creation.
