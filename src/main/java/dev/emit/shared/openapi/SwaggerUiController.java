package dev.emit.shared.openapi;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * Serves a replacement for the Swagger UI entry page.
 *
 * <p>This class owns the document and nothing else: the webfonts, the stock
 * Swagger bundles, the legend markup, and references to the two theme assets.
 * The theme itself lives in {@code /swagger/theme.css} and the behaviour that
 * CSS cannot express lives in {@code /swagger/enhance.js}, both served as
 * static resources so they stay lintable, cacheable, and reviewable as the
 * files they are rather than as string literals compiled into Java.
 *
 * <p>A runtime script is unavoidable because Swagger UI renders from React:
 * the operation rows, the title and the response tables only exist after
 * hydration and are replaced on every expand, so anything derived from them
 * has to be reapplied rather than declared once.
 */
@Hidden
@Controller
class SwaggerUiController {

    @GetMapping("/swagger-ui/index.html")
    @ResponseBody
    String index() {
        return """
                <!DOCTYPE html>
                <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>EMIT API</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap">
                    <!-- theme.css imports stock Swagger into a cascade layer, so the
                         theme outranks it without !important. -->
                    <link rel="stylesheet" type="text/css" href="/swagger/theme.css">
                    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32">
                    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16">
                    <style>
                      /* Painted before the stylesheet loads so the page never flashes white. */
                      html { background-color: #0d0f15; }
                      body { background-color: #0d0f15; color: #dde6f0; margin: 0; }
                    </style>
                  </head>
                  <body id="emit-swagger">
                    <div id="swagger-ui"></div>

                    <div id="emit-legend">
                      <div id="emit-legend-panel" data-open="false">
                        <div class="emit-legend-title">Reading this page</div>
                        <div class="emit-legend-section">
                          <div class="emit-legend-label">Schema notation</div>
                          <div class="emit-legend-rows">
                            <div class="emit-legend-row"><span class="emit-legend-pill p-type">string</span><span class="emit-legend-desc">data type</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-pill p-fmt">uuid</span><span class="emit-legend-desc">format</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-note">[1, 255] characters</span><span class="emit-legend-desc">constraint</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-note">PENDING | DONE</span><span class="emit-legend-desc">allowed values</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-mark">title<i>*</i></span><span class="emit-legend-desc">required field</span></div>
                          </div>
                        </div>
                        <div class="emit-legend-section">
                          <div class="emit-legend-label">Methods</div>
                          <div class="emit-legend-rows">
                            <div class="emit-legend-row"><span class="emit-legend-pill m-get">GET</span><span class="emit-legend-pill m-post">POST</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-pill m-put">PUT</span><span class="emit-legend-pill m-del">DELETE</span></div>
                          </div>
                        </div>
                        <div class="emit-legend-section">
                          <div class="emit-legend-label">Status codes</div>
                          <div class="emit-legend-rows">
                            <div class="emit-legend-row"><span class="emit-legend-pill s-2xx">2xx</span><span class="emit-legend-desc">success</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-pill s-4xx">4xx</span><span class="emit-legend-desc">client error</span></div>
                            <div class="emit-legend-row"><span class="emit-legend-pill s-5xx">5xx</span><span class="emit-legend-desc">server error</span></div>
                          </div>
                        </div>
                      </div>
                      <button id="emit-legend-btn" type="button" aria-expanded="false" aria-controls="emit-legend-panel" title="Reading this page">&#8759;</button>
                    </div>

                    <script src="./swagger-ui-bundle.js" charset="UTF-8"></script>
                    <script src="./swagger-ui-standalone-preset.js" charset="UTF-8"></script>
                    <script src="./swagger-initializer.js" charset="UTF-8"></script>

                    <script src="/swagger/enhance.js" charset="UTF-8"></script>
                  </body>
                </html>
                """;
    }
}
