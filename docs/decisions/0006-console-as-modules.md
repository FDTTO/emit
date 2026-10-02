# 0006. The console as a kit of ES modules, configured by the API

*What the console knows about EMIT is one file; the rest works for any OpenAPI.*

## Context

The console grew in one script of some 4,200 lines, sectioned but shared by
189 functions through one closure: the description read from Swagger's
store, the answers seen, the run being followed. Two costs followed. A reader
had to hold the whole file to change any part, and what belonged to EMIT
(its scopes, the document lifecycle, the walkthrough) sat beside what any
Swagger page could use, so the console could not serve another API without
being taken apart first.

## Decision

The console is a kit of native ES modules under `static/swagger/console/`,
loaded without a bundler, and EMIT is a module that configures it:

```
static/swagger/
├── emit.js              the API's configuration, then start(config)
└── console/
    ├── index.js         start(config): the shell, the observers, the paint loop
    ├── state.js         the configuration and the state modules share
    ├── ...              one module per concern: follow, journey, credentials,
    │                    result, editor, map, palette, statusbar, phone...
    └── theme/           the stylesheet, one file per part, in cascade order
```

- **The kit knows no API.** Scopes, credential sources, the health path, the
  lifecycle and its follow calls, the walkthrough and the body a step sends,
  the icons for resources and actions, the shared refusals and the API's own
  headers all arrive in `config`. A kit module that names a document or a
  tenant is a defect.
- **State has one owner.** Values the modules read and change together live
  on the `runtime` object `state.js` exports beside `config`; a value one
  module owns stays private to it. Imports are explicit, so what a module depends on is its
  first lines.
- **No build step.** The browser loads the modules as they are written, so
  what runs is what was reviewed, and the page needs nothing but a static
  server, which the live demo relies on.
- **The cascade is unchanged.** The stylesheet is split at its sections and
  imported in the same order, so every rule keeps its place.

The split was done by a codemod with scope analysis, not by hand: each
shared variable was classified by whether anything reassigns it, every
reference that resolves to it was rewritten, and each module's imports and
exports were computed from what it uses. The console suite ran against the
result unchanged.

## Consequences

- A module can be read, tested and replaced on its own, and the kit can
  leave this repository as it is, with `emit.js` as the example of its
  configuration.
- The browser makes one request per module; on a local or static server the
  cost is not measurable, and a production page could still bundle them.
- Class names and storage keys keep the `emit-` prefix for now. Renaming the
  namespace is a mechanical step for when the kit leaves, not a reason to
  touch every rule today.
