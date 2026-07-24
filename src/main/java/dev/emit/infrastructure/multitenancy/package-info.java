/**
 * INFRASTRUCTURE — Multi-tenancy
 *
 * Implementa o roteamento de conexões por schema PostgreSQL.
 * Esta é a camada mais crítica de segurança do EMIT — um bug aqui
 * pode causar vazamento de dados entre tenants.
 *
 * O que pertence aqui:
 *   - TenantContext.java              (ThreadLocal holder do schema atual)
 *   - SchemaConnectionProvider.java  (MultiTenantConnectionProvider Hibernate 6)
 *   - TenantIdentifierResolver.java  (CurrentTenantIdentifierResolver Hibernate 6)
 *   - TenantContextDecorator.java    (TaskDecorator — propaga tenant para threads @Async)
 *   - TenantSchemaProvisioner.java   (cria schema + executa migrations quando novo tenant é criado)
 *
 * INVARIANTE DE SEGURANÇA:
 *   Todo código que altera TenantContext.set() DEVE chamar TenantContext.clear()
 *   num bloco finally. Sem isso, o próximo request no mesmo thread herdará
 *   o tenant errado — data leak silencioso.
 */
package dev.emit.infrastructure.multitenancy;
