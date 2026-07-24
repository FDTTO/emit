/**
 * PRESENTATION — REST / Document
 *
 * Controllers HTTP e DTOs de request/response do domínio Document.
 * Esta camada conhece HTTP (ResponseEntity, @RequestBody, status codes).
 * O domínio NÃO conhece esta camada.
 *
 * O que pertence aqui:
 *   - DocumentController.java        (@RestController — endpoints de geração e status)
 *   - GenerateDocumentRequest.java   (DTO de entrada com @Valid, @NotNull)
 *   - JobAcceptedResponse.java       (DTO 202 Accepted — jobId + Location URI)
 *   - JobStatusResponse.java         (DTO de polling — status + url quando COMPLETED)
 *
 * PADRÃO HTTP DO EMIT:
 *   POST /v1/documents/generate → 202 Accepted + Location: /v1/documents/jobs/{id}
 *   GET  /v1/documents/jobs/{id} → 200 OK + {status, documentUrl?}
 *
 * Nunca retorne entidades de domínio diretamente de controllers.
 * Mapeie para DTOs de response — controla o que é exposto via API.
 */
package dev.emit.presentation.rest.document;
