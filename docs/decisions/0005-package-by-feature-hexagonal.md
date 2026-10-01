# 0005. Package by feature, ports and adapters

*Each feature owns its whole slice, and its domain owns no framework.*

## Context

Layers by technical concern (`controller/`, `service/`, `repository/`)
spread one feature across three packages: a change to document processing
touches all three, and nothing stops `TenantService` from importing
`DocumentRepository`.

## Decision

Packages follow features, and inside each the dependencies point inward:

```
document/
├── domain/         Document, DocumentRepository (port), DocumentStatus
├── application/    DocumentService, PdfGenerationService, PdfRenderer (port)
└── adapter/
    ├── in/rest/          DocumentController
    ├── in/messaging/     DocumentGenerationConsumer
    ├── out/messaging/    KafkaDocumentEventPublisher
    ├── out/persistence/  DocumentRepositoryAdapter
    ├── out/pdf/          FlyingSaucerPdfRenderer
    └── out/template/     ThymeleafDocumentTemplateRenderer
```

Ports are Java interfaces, and adapters are package-private: the Flying
Saucer renderer is reachable only through `PdfRenderer`, which the compiler
enforces. `ArchitectureTest` holds the rest on the compiled classes: the
domain depends on neither its use cases nor its adapters, the use cases
reach adapters only through ports, and the domain uses nothing from Spring
but the paging types of its repository ports.

```java
// The port, in the domain: no Spring, no JPA.
public interface TenantRepository {
    Optional<Tenant> findById(UUID id);
    Optional<Tenant> findByApiKeyHash(String apiKeyHash);
    Tenant save(Tenant tenant);
    List<Tenant> findAll();
}

// The adapter, package-private; Spring Data implements it.
interface TenantRepositoryAdapter extends JpaRepository<Tenant, UUID>, TenantRepository {
}
```

## Consequences

- A feature reads top to bottom in one place, and replacing an adapter
  (another PDF renderer, another broker) touches only that adapter.
- Two exceptions are deliberate. The entities carry JPA annotations, which
  keeps one model instead of a domain model mapped to a persistence one,
  and the repository ports page with Spring Data's `Page` and `Pageable`
  rather than a paging type of their own.
