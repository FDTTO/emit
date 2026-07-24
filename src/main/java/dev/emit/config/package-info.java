/**
 * CONFIG
 *
 * Classes de configuração Spring (@Configuration) que fazem o wire-up
 * de beans que não têm auto-configuração padrão.
 *
 * O que pertence aqui:
 *   - JpaConfig.java      (LocalContainerEntityManagerFactoryBean com Hibernate 6 multi-tenant)
 *   - AsyncConfig.java    (ThreadPoolTaskExecutor com TenantContextDecorator)
 *
 * SecurityConfig.java fica em infrastructure/security por coesão:
 * é uma configuração de infraestrutura, não de aplicação.
 *
 * REGRA: @Configuration aqui apenas para beans que WIRING de infraestrutura
 * cross-cutting. Configurações específicas de um domínio ficam no próprio
 * pacote de infraestrutura correspondente.
 */
package dev.emit.config;
