/**
 * DOMAIN — Document
 *
 * O coração do EMIT. Contém as entidades de domínio do fluxo de documentos.
 *
 * O que pertence aqui:
 *   - DocumentJob.java    (entidade que rastreia o job assíncrono)
 *   - DocumentStatus.java (enum: PENDING, PROCESSING, COMPLETED, FAILED, DELIVERY_FAILED)
 *   - DocumentJobRepository.java (interface Spring Data)
 *
 * DocumentJob deve expor métodos de negócio, não só getters:
 *   job.markAsProcessing();
 *   job.complete(storageKey);
 *   job.fail(reason);
 * O estado é gerenciado pela própria entidade, não por serviços externos.
 */
package dev.emit.domain.document;
