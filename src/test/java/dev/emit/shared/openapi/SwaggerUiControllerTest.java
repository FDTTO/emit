package dev.emit.shared.openapi;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.util.Arrays;

import org.junit.jupiter.api.Test;

class SwaggerUiControllerTest {

    /*
     * The page's load, and Swagger with it, waits for the console's whole
     * import graph; listed up front, every module is fetched at once instead
     * of in waves as each import is found.
     */
    @Test
    void shouldPreloadEveryModuleOfTheConsole() throws Exception {
        String page = new SwaggerUiController().index();
        String[] modules = new File("src/main/resources/static/swagger/console").list((dir, name) -> name.endsWith(".js"));

        assertThat(modules).isNotEmpty();
        Arrays.stream(modules).forEach(module ->
                assertThat(page).contains("<link rel=\"modulepreload\" href=\"/swagger/console/" + module + "\">"));
        assertThat(page).contains("<link rel=\"modulepreload\" href=\"/swagger/emit.js\">")
                .contains("<script type=\"module\" src=\"/swagger/emit.js\"></script>");
    }
}
