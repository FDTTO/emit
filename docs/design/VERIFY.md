# Verifying the console

The console is checked in a real browser by [Prumo](https://github.com/FDTTO/prumo),
a submodule at `tools/prumo` (clone with `--recursive`, or run
`git submodule update --init`). `prumo.json` at the repository's root tells it
where the app serves the console and how to boot it. Prumo's README covers the
tool itself: the scenario API, coverage, mutation, fidelity, and why it works
the way it does. This page covers what is particular to this console.

## What to reach for

Everything runs against the app on `localhost:8080`; `--base URL` points it at
another instance.

| Question | Command |
|---|---|
| Did anything that used to work stop working? | `python tools/prumo suite` |
| Does one behaviour hold, at one width? | `python tools/prumo run docs/design/scenarios/NAME.js --width 375` |
| What does no scenario reach? | `python tools/prumo suite --coverage` |
| Would the suite notice this function breaking? | `python tools/prumo mutate --only NAME` |
| Does the console match its design? | `python tools/prumo fidelity [STATE]` |
| Does the page still read as one family of components? | `python tools/prumo run docs/design/inventory.js` |
| Did a Java change work on the running app? | a second instance on 8081 (below) |

CI runs the suite in the `ui-suite` job on every push, two runs at a time, and
holds the demo against the app with `prumo visit` in the `demo` job.

## What lives here

- `harness.html` boots the real bundles, `theme.css` and the console against
  the real `/v3/api-docs`, with the operations listed and the schemas open,
  from the Swagger config the app serves. A scenario sets
  `window.scenarioConfig` to run under other settings, another spec URL
  included. `requestAnimationFrame` runs on a timer, since the console
  repaints through it and virtual time starves it.
- `scenarios/` is the suite. Each scenario records a behaviour that was
  verified when it shipped, so the suite is the characterization net under
  any later change: run it before and after.
- `fidelity/` holds the states of the two reference pages (`states/`, one
  scenario each, named for the page's hash), the pairs of elements measured
  (`roles.js`), and the answers the references show as already given
  (`shared.js`). The deliberate departures from the references are listed in
  `README.md`.
- `snapshot.js` and `inventory.js` are probes run by hand: a fixed state for
  a pixel comparison, and the interface inventory.

## Pixel comparison

A change that must not alter the rendering is captured before and after:

```
set PAGE=(function(){var b=document.body.getBoundingClientRect();return {x:0,y:0,width:Math.ceil(b.width),height:Math.ceil(document.body.scrollHeight)};})()

python tools/prumo run docs/design/snapshot.js --out %TEMP%/before --clip "%PAGE%"
...make the change...
python tools/prumo run docs/design/snapshot.js --out %TEMP%/after --clip "%PAGE%"
python tools/prumo diff %TEMP%/before_0.png %TEMP%/after_0.png --ignore-from %TEMP%/after.json
```

`snapshot.js` executes nothing, because a token or a duration differs between
runs, and reports the timestamps inside schema examples for `diff` to mask.
Calibrate first: two runs of unchanged code must report `identical`.

## Traps of this page

- **Faking a response needs the request too.** Swagger's live response block
  reads the mutated request and crashes without it; `V.fakeResponse` sets both.
- **A fake on an operation still resolving is wiped.** Resolving mounts the
  body's content-type control, which clears the response. Wait for the
  operation's `.responses-wrapper`; `V.fakeResponse` fails out loud otherwise.
- **Authorize with the store's own definition** (`V.authorize` does), not a
  plain object: Swagger's persistence step calls `schema.get`.
- **Log out only held schemes** (`V.logoutHeld` does): Swagger's logout throws
  on one it does not hold.
- **The harness must mirror the served configuration.** It lacked
  `persistAuthorization` once and could not see persistence at all; it now
  reads the config the app serves.
- **The app sends `X-Frame-Options: DENY`**, correctly, so nothing frames the
  console; widths are set on the viewport instead.

## Method particular to this repository

- **Java changes are verified on a second instance.**
  `SPRING_PROFILES_ACTIVE=dev mvn -q spring-boot:run -Dspring-boot.run.arguments=--server.port=8081`,
  wait for "Started" and for the log to go quiet (tenant schema migrations run
  at startup), check with `--base http://localhost:8081`, then stop only that
  instance. The one on 8080 belongs to whoever started it, and both serve the
  same `target/classes`.
- **Anything that creates data cleans up after itself**, usually by
  deactivating the tenant it registered.
