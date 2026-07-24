/**
 * APPLICATION — Document use cases
 *
 * Orquestra o fluxo de geração e entrega de documentos.
 * Conhece o domínio, não conhece HTTP nem detalhes de persistência.
 *
 * O que pertence aqui:
 *   - DocumentProcessorService.java  (@Async — processa jobs em background)
 *   - DocumentJobService.java        (cria jobs, consulta status)
 *
 * Os serviços desta camada recebem e retornam objetos de domínio ou
 * primitivos/records simples — nunca HttpServletRequest, ResponseEntity,
 * nem classes específicas de JPA como EntityManager diretamente.
 */
package dev.emit.application.document;
