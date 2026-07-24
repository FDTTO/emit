/**
 * INFRASTRUCTURE — Security
 *
 * Filtros de autenticação e configuração do Spring Security 6.
 *
 * O que pertence aqui:
 *   - SecurityConfig.java      (SecurityFilterChain — Spring Security 6, sem WebSecurityConfigurerAdapter)
 *   - ApiKeyAuthFilter.java    (OncePerRequestFilter — valida X-API-Key, seta tenant + auth)
 *   - JwtAuthFilter.java       (OncePerRequestFilter — valida Bearer token, extrai tenant do claim)
 *   - JwtService.java          (emite e parseia JWTs via JJWT 0.12.x)
 *   - DocumentGuard.java       (@Component para @PreAuthorize — valida ownership por tenant)
 *
 * ORDEM DOS FILTROS NO CHAIN:
 *   JwtAuthFilter → ApiKeyAuthFilter → UsernamePasswordAuthenticationFilter
 *   (mais específico primeiro: se JWT presente, resolve antes de checar API key)
 */
package dev.emit.infrastructure.security;
