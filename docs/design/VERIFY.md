# Verifying the Swagger UI

How changes to this page are checked, what to reach for, and the traps that
have each cost at least one wrong conclusion before they were understood.
Everything here runs against the app on `localhost:8080` with headless Edge.

## What to reach for

| Question | Tool |
|---|---|
| Did anything that used to work stop working? | `verify.py --suite` |
| Does it render, measure right, behave right? | `verify.py` with a scenario |
| Is it reachable and visible by keyboard? | a scenario using `V.press('Tab')` |
| Does it hold at phone width? | `verify.py --width 320` |
| Does it survive something paced by time (polling, a real pipeline)? | `verify.py` (realtime, the default) |
| A long scenario that is mostly waiting? | `verify.py --virtual MS` |
| A picture of a region, below the fold included | `verify.py --clip JS` |
| Did a Java change work on the running app? | a second instance on 8081 (below) |

## verify.py

```
python docs/design/verify.py SCENARIO.js [--width W] [--wait MS | --virtual MS]
                             [--spec-url URL] [--clip JS]... [--out PREFIX] [--keep]
```

A scenario is plain JavaScript. It runs inside `verify-harness.html` after
`verify-lib.js`, in its own function scope, records expectations with
`check(name, pass, detail)` and plain values with `L(key, value)`, and acts
on the page through `V`:

- `V.execute(tag, operationId, body, atMs)`: open, Try it out, fill, Execute,
  as a reader would. `V.open(tag, operationId, atMs)` only opens.
- `V.fakeResponse(path, method, status, body, url)`: a response in Swagger's
  store as if Execute had run, without touching the backend.
- `V.press(key)`: a real, trusted key press (`Tab`, `Shift+Tab`, `Enter`,
  `Escape`, `Space`, arrows), delivered by the runner. Realtime only.
- `V.jwt(secondsFromNow)`: a token with an exact `exp`.
- `allowErrors(regex)`: console errors a scenario provokes on purpose; any
  other error still fails the run.
- `done()`: the scenario has finished. The runner reads the log as soon as
  it is called, and a run that never calls it fails as unfinished. The wait
  is only a ceiling: reading at a fixed time lets a slow page load drop a
  scenario's last check without any error.
- `V.until(ready, then, timeoutMs)`: wait for a condition, not a clock.
  Anything that follows a real backend call waits this way: under a
  parallel suite the response can take seconds longer than alone.
- `V.authorize(scheme, value)` / `V.held(scheme)` / `V.logoutHeld()`
- `V.response(path, method)` / `V.status(...)` / `V.json(...)` /
  `V.param(path, method, key)`
- `V.text(selector)` / `V.box(selector)`

Console errors and uncaught exceptions are collected into `errors` on their
own, and a non-empty `errors` fails the run (exit code 1). The script builds
the page, publishes it next to the app's static files, runs it, prints the
log as JSON and removes what it published.

### The regression suite

`python docs/design/verify.py --suite` runs every scenario in
`docs/design/scenarios/`, once per width it declares, three at a time, and
prints one line per run. A scenario declares its settings in its header:
`// @widths 320,1280`, `// @wait 20000`, `// @virtual 40000`,
`// @spec-url /missing`. `--only topbar` narrows it, `--verbose` prints every
check. It exits 1 if a check fails, a console error is logged, or a run
produces no checks. Each scenario records a behaviour that was verified when
it shipped, so the suite is the
characterization net under any later change: run it before and after.

`verify-realtime.js` is the runner underneath: Node 22, the DevTools
protocol over the native WebSocket, a throwaway profile and a free port per
run, and the viewport set through `Emulation.setDeviceMetricsOverride`.

## Realtime or virtual

**Realtime** (default) runs on the wall clock. It is the honest mode for
anything paced by time, and the only one that can judge animation frames.

**Virtual** runs on a time budget that stops for network fetches and skips
idle time. It is fast for long, mostly idle scenarios, and wrong for anything
timed against a real backend: a follow that backs off 1s, 2s, 4s, 8s would use
its whole schedule in under a second of real time while the real pipeline
takes eight.

## Traps, and what now handles each

- **Virtual time freezes transitions.** A transitioned property reads as its
  pre-change value. The harness runs with reduced motion; measure end states,
  not mid-transition ones.
- **Virtual time starves `requestAnimationFrame`.** `enhance.js` repaints
  through rAF, so under virtual time the paint loop ran or did not at random.
  `verify-harness.html` schedules rAF on a timer.
- **Virtual time skips idle time.** See above; use realtime.
- **`--window-size` is clamped near 490px and ignored for pages opened over
  the protocol.** The runner sets the viewport itself; `--width 320` works.
- **Scrolling breaks `--screenshot`.** `--clip` captures any region with
  `captureBeyondViewport`, no scrolling.
- **`msedge --dump-dom` writes nothing to a non-console parent** on Windows.
  Everything reads results through `Runtime.evaluate` instead.
- **A fixed debugging port can attach to a previous run's instance** still
  shutting down, one left on a paused clock. The runner uses port 0 and reads
  `DevToolsActivePort`.
- **The app sends `X-Frame-Options: DENY`.** Correct for the app, so nothing
  frames it; the runner sets the width directly instead.
- **Faking a response in Swagger's store needs the request too:**
  `setRequest` and `setMutatedRequest`, since `LiveResponse` reads the mutated
  one and crashes without it.
- **Authorize with the store's own definition** (`V.authorize` does), not a
  plain object: Swagger's persistence step calls `schema.get`.
- **Log out only held schemes** (`V.logoutHeld` does): Swagger's logout
  wrapper throws on one it does not hold.
- **The harness must mirror production config** for whatever it checks. It
  lacked `persistAuthorization` once and could not see persistence at all.
- **A comment that quotes the result tag is part of the dump.** Never write a
  result element's tag literally in a harness comment.
- **Programmatic focus is not keyboard focus.** After any click, Chromium
  treats `focus()` as pointer focus and never enters `:focus-visible`, so a
  focus check read every ring as missing. Use `V.press('Tab')`: real keys, and
  a real walk of the tab order.
- **A headless page may not hold the window's focus**, and keys sent to it go
  nowhere. The runner enables focus emulation.
- **`var name` at a script's top level is `window.name`**, which turns a
  function into a string. Scenarios run in their own function scope.
- **The runner must clean up after itself.** On Windows the launched
  `msedge.exe` hands off to the real browser and exits, so killing its tree
  killed nothing: 398 orphaned browsers and 11.8 GB of profiles filled the
  disk. The browser is closed over the protocol and its profile removed.

## Method

- **The check has to be able to fail.** Before trusting a pass, ask whether
  the same check would have failed for the symptom reported. Existing in the
  DOM is not being visible: a 0x0 dialog passes any existence check.
- **Prove a check can fail by sabotaging what it guards, and prove the
  sabotage bit.** The keyboard scenario passed with every focus ring removed:
  first because the sabotage itself added a visible change, then because the
  theme's rule outranked the sabotage, then because a helper broke on the
  failure path. Each was found by looking at what the run actually measured
  (which indicator each control showed), not at its verdict. Only when the
  sabotaged run failed and named the right controls was the check trusted.
- **One claim per verified thing.** A fix that touches two places is verified
  in both.
- **Measure each thing against its own reference.** Text against its own
  container's content edge, not against a neighbour: that is how a
  wrongly-removed leading space was caught.
- **When a check disagrees with itself, instrument before theorising.** The
  flaky response note was found by logging each exit of the painter.
- **Java changes are verified on a second instance.** `SPRING_PROFILES_ACTIVE=dev
  mvn -q spring-boot:run -Dspring-boot.run.arguments=--server.port=8081`,
  wait for "Started" and for the log to go quiet (tenant schema migrations run
  at startup), check, then stop only that instance. The one on 8080 belongs
  to whoever started it.
- **Anything that creates data cleans up after itself**, usually by
  deactivating the tenant it registered.
