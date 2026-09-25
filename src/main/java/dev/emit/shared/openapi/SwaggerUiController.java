package dev.emit.shared.openapi;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * Serves a replacement for the Swagger UI entry page.
 *
 * <p>This class owns the document and nothing else: the webfonts, the stock
 * Swagger bundles, and references to the two theme assets.
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
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
                    <!-- theme.css imports stock Swagger into a cascade layer, so the
                         theme outranks it without !important. -->
                    <link rel="stylesheet" type="text/css" href="/swagger/theme.css">
                    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32">
                    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16">
                    <style>
                      /* Painted before the stylesheet loads so the page never flashes white. */
                      html { background-color: #07090d; }
                      body { color: #aab6c6; margin: 0; }
                    </style>
                  </head>
                  <body id="emit-swagger">
                    <div id="swagger-ui"></div>

                    <script src="./swagger-ui-bundle.js" charset="UTF-8"></script>
                    <script src="./swagger-ui-standalone-preset.js" charset="UTF-8"></script>
                    <script src="./swagger-initializer.js" charset="UTF-8"></script>

                    <script src="/swagger/enhance.js" charset="UTF-8"></script>
                  </body>
                </html>
                """;
    }
}
