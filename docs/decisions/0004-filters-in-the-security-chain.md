# 0004. Filters inside the SecurityFilterChain

*An order that `@Order` cannot guarantee.*

## Context

Servlet filters registered with `@Order` run as independent filters, before
the `SecurityFilterChain` has set up the security context. `TenantFilter`
writes the tenant's authentication to that context, and `RateLimitFilter`
reads the tenant `TenantFilter` resolved. As `@Order` filters, the write
lands before the context exists and is replaced when the chain starts, and
the rate limiter finds no tenant.

## Decision

The filters are registered inside the chain, so each runs with the context
initialised and in an order stated in one place:

```java
http
    .addFilterBefore(tenantFilter,    UsernamePasswordAuthenticationFilter.class)
    .addFilterAfter(rateLimitFilter,  TenantFilter.class)
    .addFilterBefore(jwtFilter,       UsernamePasswordAuthenticationFilter.class);
```

Spring Security applies the chain to every dispatch type, and the `ERROR`
and `ASYNC` dispatches are permitted. An error the container forwards to
`/error` passes the chain again without the original request's
authentication, so a refusal there would replace the error's status with a
`401`. Today no handler lets an exception reach the container (the
exception handler and the filters write every error themselves), so the
rule guards a path the code does not take rather than one the tests
exercise.

## Consequences

- The filters' order and their access to the security context are one
  configuration to read, not annotations spread across classes.
- A refusal from a filter is written by the filter itself, in the API's
  error shape, since no controller runs.
