/**
 * DOMAIN — Tenant
 *
 * Contém a entidade Tenant e a interface TenantRepository.
 *
 * REGRA: nenhuma importação de Spring, JPA, HTTP, ou Jackson
 * deveria existir aqui no modelo ideal. Nesta implementação pragmática,
 * @Entity é permitida nas entidades, mas @JsonProperty, @RequestBody,
 * @RestController são PROIBIDAS neste pacote.
 *
 * O que pertence aqui:
 *   - Tenant.java         (@Entity com lógica de negócio)
 *   - TenantRepository.java (interface Spring Data JPA)
 *   - TenantStatus.java   (enum de estados válidos)
 */
package dev.emit.domain.tenant;
