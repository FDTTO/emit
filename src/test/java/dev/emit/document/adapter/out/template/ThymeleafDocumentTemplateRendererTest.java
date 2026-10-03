package dev.emit.document.adapter.out.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;

import dev.emit.document.domain.Document;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

class ThymeleafDocumentTemplateRendererTest {

    private final ThymeleafDocumentTemplateRenderer renderer = new ThymeleafDocumentTemplateRenderer(engine());

    private static TemplateEngine engine() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        TemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }

    @Test
    void shouldRenderTheDocumentWithItsCreationTimeInUtc() {
        Document document = Document.create("Q3 Invoice", "<h1>Invoice</h1><p>Total: $1,200.00</p>");

        String html = renderer.render(document);

        assertThat(html)
                .contains("Q3 Invoice", "<h1>Invoice</h1><p>Total: $1,200.00</p>")
                .contains(document.getCreatedAt().toLocalDate().toString());
    }

    /*
     * The template runs while the document is PROCESSING, so any state it
     * printed would be PROCESSING in every PDF ever rendered.
     */
    @Test
    void shouldNotPrintTheDocumentStateItIsRenderedIn() {
        Document document = Document.create("Q3 Invoice", "<p>Total</p>");
        document.markAsProcessing(OffsetDateTime.now());

        String html = renderer.render(document);

        assertThat(html).doesNotContain("PROCESSING").doesNotContain("PENDING");
    }
}
