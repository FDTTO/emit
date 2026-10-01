# Architecture decisions

Each record names a failure mode, the structural choice that removes it,
and the trade-off accepted in return. They describe the code as it is; a
decision that changes gets its record rewritten, with the reason in the
commit that changes it.

| Record | Concern | Chosen | Rejected |
|:---|:---|:---|:---|
| [0001](0001-schema-per-tenant.md) | Tenant isolation | Schema per tenant | Row-level security, a `tenant_id` column |
| [0002](0002-kafka-with-dead-letter-queue.md) | Asynchronous work | Kafka, acknowledged before the `202`, with a dead-letter queue | `@Async` on a thread pool |
| [0003](0003-redis-lua-rate-limiting.md) | Rate limiting | One atomic Lua script on Redis | An in-memory bucket per instance |
| [0004](0004-filters-in-the-security-chain.md) | Filter order | Filters inside the `SecurityFilterChain` | `@Order` servlet filters |
| [0005](0005-package-by-feature-hexagonal.md) | Code organisation | Package by feature, ports and adapters | Layers by technical concern |
