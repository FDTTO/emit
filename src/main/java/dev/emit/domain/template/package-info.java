/**
 * DOMAIN — Template
 *
 * Templates de documentos configuráveis por tenant.
 *
 * O que pertence aqui:
 *   - Template.java        (entidade pai: nome, tipo, conteúdo HTML base)
 *   - TemplateField.java   (entidade filha: variáveis do template — @OneToMany)
 *   - TemplateRepository.java
 *
 * Nota sobre @OneToMany: TemplateField é uma entidade dependente de Template.
 * A relação deve usar CascadeType.ALL + orphanRemoval=true para que
 * campos removidos do template sejam automaticamente deletados do banco.
 */
package dev.emit.domain.template;
