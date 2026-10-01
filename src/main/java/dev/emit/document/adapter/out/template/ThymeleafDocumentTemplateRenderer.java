package dev.emit.document.adapter.out.template;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import dev.emit.document.application.DocumentTemplateRenderer;
import dev.emit.document.domain.Document;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
class ThymeleafDocumentTemplateRenderer implements DocumentTemplateRenderer {

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'");

    private final TemplateEngine templateEngine;

    @Override
    public String render(Document document) {
        Context context = new Context();
        context.setVariable("document", document);
        context.setVariable("createdAt", document.getCreatedAt().withOffsetSameInstant(ZoneOffset.UTC).format(TIMESTAMP_FORMAT));
        context.setVariable("renderedAt", OffsetDateTime.now(ZoneOffset.UTC).format(TIMESTAMP_FORMAT));
        return templateEngine.process("document-pdf", context);
    }
}
