package dev.emit.document.application;

/** The broker did not confirm a generation request, so it was not queued and nothing will run. */
public class GenerationNotQueuedException extends RuntimeException {

    public GenerationNotQueuedException(Throwable cause) {
        super("The generation request could not be queued. Try again in a few seconds.", cause);
    }
}
