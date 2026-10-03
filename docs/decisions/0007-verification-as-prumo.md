# 0007. Browser verification as its own tool, consumed as a submodule

*The console is checked by Prumo; this repository keeps only what is particular to the console.*

## Context

The tooling that checks the console in a real browser grew here: a runner
over the DevTools protocol, the in-page helpers scenarios act through, the
suite, coverage of styles and functions, mutation, fidelity against the
reference pages, a pixel comparison. About two thousand lines, and almost
none of it about EMIT: the paths, the base URL, the Swagger helpers and the
fidelity states were the only parts that knew which page they checked. Any
other page, in this portfolio or elsewhere, would have needed a copy.

## Decision

The tooling is [Prumo](https://github.com/FDTTO/prumo), a repository of its
own, public, added here as a submodule at `tools/prumo` and pinned to a
commit. This repository describes the page in `prumo.json` and keeps what is
its own: the harness that boots the console, the scenarios, the fidelity
states and roles, and the probes.

- **Public, not private with a copy.** A private tool would have needed a
  vendored copy here, kept in sync by hand, or a token in CI and a suite the
  README announces but no reader could run. Public, there is one source and
  nothing to sync.
- **A submodule, not a package.** Prumo is Python and Node with no
  dependencies; publishing it to two registries would add releases to
  manage and buy nothing a pinned commit does not.
- **Swagger UI is an adapter.** The core knows pages, not frameworks; what
  acts through Swagger's store and controls is `adapters/swagger-ui.js`,
  loaded because `prumo.json` asks for it.

The extraction changed nothing the suite measures: through Prumo the suite
ran 39 of 39 with the same coverage as before, 844 of 956 rules and 429 of
464 functions, and every fidelity state reported the same differences role
by role. It did change what fidelity reports as missing: a role neither page
draws in a state is no longer counted as a difference.

## Consequences

- A clone that runs the console's suite needs `--recursive`; the application
  itself does not.
- A fix to the tooling is made in Prumo, then the submodule moves to it here.
- The leak that once filled a disk with browser profiles is fixed where every
  page benefits: the process that outlives the browser owns its profile, and
  a profile that cannot be removed fails the run.
