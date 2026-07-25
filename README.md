# EMIT

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![CI](https://github.com/FDTTO/emit/actions/workflows/ci.yml/badge.svg)](https://github.com/FDTTO/emit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

Multi-tenant document processing engine. Each client operates in full data isolation via PostgreSQL schema separation. Authenticated requests trigger async PDF generation with tenant context propagated across thread boundaries.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Roadmap](#roadmap)

---

## Overview

EMIT exposes a REST API where tenants authenticate via API Key and submit documents for PDF generation. The processing pipeline is fully asynchronous: the HTTP thread is released immediately while a dedicated thread pool handles rendering, status updates, and retry logic.

Key design goals:

- **Data isolation**: tenants cannot access each other's data under any circumstances
- **Non-blocking**: PDF generation never holds an HTTP thread
- **Resilient**: transient rendering failures are retried with exponential backoff

---

## Architecture

### Multi-tenancy via schema isolation

Each tenant owns a dedicated PostgreSQL schema. On every request, `TenantFilter` resolves the tenant from the `X-API-Key` header (SHA-256 hash lookup), writes it to a `ThreadLocal` via `TenantContext`, and `SchemaMultiTenantConnectionProvider` issues `SET search_path TO {schema}` on each connection before use.

New tenants are provisioned automatically on `POST /v1/tenants`: the schema is created and all Liquibase migrations are applied immediately. On startup, `TenantMigrationRunner` ensures all existing schemas are up to date.

> Schema isolation was chosen over row-level security and Spring Cloud multi-tenancy. RLS requires per-table policies and application-level enforcement. Spring Cloud adds significant operational overhead. Schema isolation provides the same data boundary with no additional infrastructure.

### Async processing and tenant context propagation

PDF generation runs on a dedicated `ThreadPoolTaskExecutor` (`docProcessorExecutor`, core=4, max=10). The challenge: `ThreadLocal` values are not propagated automatically across thread boundaries.

`TenantContextDecorator` implements Spring's `TaskDecorator` interface, capturing the tenant identifier from the HTTP thread before dispatch and restoring it inside the worker thread:

```
HTTP thread (tenant = "acme")
    └── TenantContextDecorator captures "acme"
        └── doc-processor-1 restores "acme" → SET search_path TO acme
```

### Retry strategy

`@Retryable` is placed on `FlyingSaucerPdfRenderer.render()`, not on `PdfGenerationService.generate()`. The distinction matters: `@Retryable` works via Spring AOP proxy. Placing it on the same method as `@Async` would only retry the thread dispatch, not the actual execution inside the worker thread. Since `PdfGenerationService` calls `pdfRenderer.render()` through an injected `PdfRenderer` interface, the proxy intercepts correctly.

Configuration: 3 attempts, exponential backoff starting at 500ms with multiplier 2, `@Recover` logs and rethrows with a clear message.

### Testability

`PdfGenerationService` depends on the `PdfRenderer` interface, not `FlyingSaucerPdfRenderer` directly. This decoupling allows unit tests to mock the renderer in isolation. The test suite follows the testing pyramid: Mockito unit tests verify service logic, `@WebMvcTest` slice tests cover the HTTP layer independently, and Testcontainers integration tests validate the complete flow against a real PostgreSQL instance.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Java 21 | Core language |
| Spring Boot 3.5 | Web, Data JPA, Security, Async, Retry, Actuator |
| PostgreSQL 16 | Persistence with schema-based multi-tenancy |
| Liquibase | Versioned schema migrations (`ddl-auto=none`) |
| JJWT 0.12.5 | JWT generation and validation (HMAC-SHA256) |
| Flying Saucer 9.1.22 | HTML-to-PDF rendering via Thymeleaf templates |
| Testcontainers | Ephemeral PostgreSQL for integration tests |
| Lombok | Boilerplate reduction |

---

## Getting Started

### Prerequisites

- Java 21+
- Maven 3.9+
- Docker Desktop

### Setup

```bash
# Clone the repository
git clone https://github.com/FDTTO/emit.git
cd emit

# Start PostgreSQL (requires port 5432 to be free)
docker compose up -d postgres

# Run (dev profile is configured as default)
mvn spring-boot:run
```

The application starts on `http://localhost:8080`. Default admin credentials: username `admin`, password `admin123`.

Optionally, start pgAdmin at `http://localhost:5050` (email `admin@emit.dev`, password `admin`):

```bash
docker compose up -d
```

### Running tests

Docker must be running for Testcontainers to spin up a PostgreSQL instance.

```bash
mvn test
```

---

## API Reference

### Authentication

`POST /auth/login`

**Request body**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Use the token as `Authorization: Bearer <token>` for all tenant management endpoints.

---

### Tenants

Requires `Authorization: Bearer <token>`.

`POST /v1/tenants`

**Request body**
```json
{
  "name": "Acme Corp",
  "schemaName": "acme_corp"
}
```

> `schemaName` must be a valid PostgreSQL identifier: lowercase, no spaces, underscores allowed.

**Response**
```json
{
  "id": "a3bb189e-8bf9-3888-9912-ace4e6543002",
  "name": "Acme Corp",
  "schemaName": "acme_corp",
  "active": true,
  "createdAt": "2026-07-24T03:00:00Z",
  "apiKey": "a3f2b9c4e8d1f7a6b2c9d4e1f8a3b7c2d9e4f1a8b3c7d2e9f4a1b8c3d7e2f9a4"
}
```

> `apiKey` is returned only once and stored as a SHA-256 hash. It cannot be recovered.

| Method | Route | Description |
|---|---|---|
| `GET` | `/v1/tenants` | List all tenants |
| `GET` | `/v1/tenants/{id}` | Get tenant by ID |

---

### Documents

Requires `X-API-Key: <key>`.

`POST /v1/documents`

**Request body**
```json
{
  "title": "Service Agreement",
  "content": "This agreement is entered into between the parties..."
}
```

**Response**
```json
{
  "id": "c7d4f2a1-1234-5678-90ab-cdef12345678",
  "title": "Service Agreement",
  "content": "This agreement is entered into between the parties...",
  "status": "PENDING",
  "createdAt": "2026-07-24T03:00:00Z"
}
```

| Method | Route | Description |
|---|---|---|
| `GET` | `/v1/documents` | List documents for the tenant |
| `GET` | `/v1/documents/{id}` | Get document by ID |
| `POST` | `/v1/documents/{id}/generate` | Generate PDF (returns `application/pdf`) |

Document status lifecycle: `PENDING` → `PROCESSING` → `DONE` / `FAILED`

---

## Roadmap

- [ ] GitHub Actions CI
- [ ] Docker Compose
- [ ] Swagger / OpenAPI
- [ ] Rate limiting per tenant (Bucket4j)
- [ ] Pagination on `GET /v1/documents`

---

## Author

**Matheus Fedatto** · [LinkedIn](https://www.linkedin.com/in/matheusfedatto) · [GitHub](https://github.com/FDTTO)

---

## License

[MIT](LICENSE)
