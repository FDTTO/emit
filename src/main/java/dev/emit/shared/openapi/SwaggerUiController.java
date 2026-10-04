package dev.emit.shared.openapi;

import java.io.IOException;
import java.util.Arrays;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * Serves a replacement for the Swagger UI entry page: the document, the
 * webfonts, the stock Swagger bundles and the two theme assets. The theme and
 * the console's modules stay static resources under {@code /swagger/}.
 *
 * <p>The console needs a runtime script because Swagger UI renders with React:
 * operation rows and response tables exist only after hydration and are
 * replaced on every expand, so whatever is derived from them is reapplied.
 */
@Hidden
@Controller
class SwaggerUiController {

    private static final String PAGE = """
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
                <!-- Every module at once: the page's load event, which starts
                     Swagger, waits for the console's whole import graph. -->
            MODULE_PRELOADS
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

                <script type="module" src="/swagger/emit.js"></script>
              </body>
            </html>
            """;

    private final String page;

    SwaggerUiController() throws IOException {
        Resource[] modules =
                new PathMatchingResourcePatternResolver().getResources("classpath:/static/swagger/console/*.js");
        String preloads = Stream.concat(
                        Stream.of("emit.js"),
                        Arrays.stream(modules)
                                .map(Resource::getFilename)
                                .filter(Objects::nonNull)
                                .sorted()
                                .map(name -> "console/" + name))
                .map(path -> "    <link rel=\"modulepreload\" href=\"/swagger/" + path + "\">")
                .collect(Collectors.joining("\n"));
        this.page = PAGE.replace("MODULE_PRELOADS", preloads);
    }

    @GetMapping("/swagger-ui/index.html")
    @ResponseBody
    String index() {
        return page;
    }
}
