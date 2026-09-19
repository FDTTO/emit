# Design reference

## `swagger-ui-target.html`

The visual target for the Swagger UI theme. Open it in a browser: it
is a standalone file with no build step and no dependencies beyond the two
webfonts it links.

This file is the specification. `src/main/resources/static/swagger/theme.css`
and `swagger/enhance.js` exist to reproduce it on top of the markup Swagger UI
actually renders, so when the two disagree, this file is right and the
implementation is wrong.

It is versioned with the code so the theme always has a reference to check
against. Changes to the theme start here.

### The rules it encodes

Four decisions carry most of the design. They are worth stating because a
future change that violates one will look arbitrary rather than wrong.

**Colour means outcome, never structure.** Green, amber and red are spent only
on results: response status, terminal document states. HTTP methods use one
desaturated steel-blue family and are told apart by their label. Before this
split, the green accent of a `POST` sat beside the green of a `201` and the two
were indistinguishable despite meaning unrelated things.

**Shape means category.** A rectangle is a type, a capsule is a format, dim
text behind a bullet is a constraint, and required is a typographic mark. A
constraint is a note about a field rather than a label on it, so it is not
given a box. Making every short string a pill was what flattened the page into
a catalogue.

**Monospace means machine output.** Paths, payloads, headers and identifiers
are mono. Identity and prose are set in the grotesque. The API title follows
this: a monospaced face at display size gives `I` the same advance as `M` and
opens holes between the letters.

**A figure has to show mechanism.** The lifecycle diagram earns its place by
showing that a document is persisted before it is queued, that Kafka sits
between acceptance and work, and that the two terminal states are exclusive.
Every marker hangs from a single horizontal axis and the outcomes are mirrored
across it, so the figure stays symmetric no matter how long the labels get.

### What it deliberately leaves out

The mockup shows one expanded operation, one collapsed one and two schemas.
That is enough to pin down every component. It is not a full page render and
should not grow into one: a reference that has to be maintained in parallel
with the product stops being consulted.
