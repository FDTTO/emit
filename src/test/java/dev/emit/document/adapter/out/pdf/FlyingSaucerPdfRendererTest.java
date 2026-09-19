package dev.emit.document.adapter.out.pdf;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sun.net.httpserver.HttpServer;

class FlyingSaucerPdfRendererTest {

    private final FlyingSaucerPdfRenderer renderer = new FlyingSaucerPdfRenderer();
    private final AtomicInteger requests = new AtomicInteger();
    private HttpServer server;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            requests.incrementAndGet();
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    /*
     * Document content is tenant-supplied HTML. If the renderer followed its
     * URLs, a tenant could make the server call any address it can reach.
     */
    @Test
    void shouldNotFetchResourcesReferencedByTheDocument() {
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        String html = "<html><head><link rel=\"stylesheet\" href=\"" + base + "/style.css\"/></head>"
                + "<body><p>Invoice</p><img src=\"" + base + "/internal\"/></body></html>";

        byte[] pdf = renderer.render(html);

        assertThat(requests.get()).isZero();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void shouldStillRenderEmbeddedImages() {
        String pixel = "data:image/png;base64,"
                + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

        byte[] pdf = renderer.render("<html><body><img src=\"" + pixel + "\"/></body></html>");

        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        assertThat(new String(pdf)).contains("/Image");
    }
}
