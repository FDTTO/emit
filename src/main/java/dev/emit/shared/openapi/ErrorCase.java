package dev.emit.shared.openapi;

import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An error an operation answers, published as a named example with the
 * message the API actually writes. Refusals every guarded route shares (no
 * credential, wrong credential, rate limit) and a malformed id are added
 * from the route itself and need no declaration here.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(ErrorCases.class)
public @interface ErrorCase {

    /** The id examples use, so a message quoting it reads like a real one. */
    String EXAMPLE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

    int status();

    /** The example's key in the spec; the contract test triggers it by this name. */
    String name();

    String summary();

    String message();
}
