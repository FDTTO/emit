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
| Does a refactor leave the page looking the same? | `snapshot.js` + `pixdiff.py` |
| Does the page still read as one family of components? | `inventory.js` (below) |
| Does it match its design, element by element? | `fidelity.py` (below) |
| Why does a style not take? | `V.rules(selector, property)` in a scenario |
| Did a Java change work on the running app? | a second instance on 8081 (below) |

## verify.py

```
python docs/design/verify.py SCENARIO.js [--width W] [--wait MS | --virtual MS]
                             [--spec-url URL] [--clip JS]... [--out PREFIX] [--keep]
                             [--base URL]
```

A scenario is plain JavaScript. It runs inside `verify-harness.html` after
`verify-lib.js`, in its own function scope, records expectations with
`check(name, pass, detail)` and plain values with `L(key, value)`, and acts
on the page through `V`:

- `V.execute(tag, operationId, body, atMs)`: open, Try it out, fill, Execute,
  as a reader would. `V.open(tag, operationId, atMs)` only opens.
- `V.fakeResponse(path, method, status, body, url)`: a response in Swagger's
  store as if Execute had run, without touching the backend. On an
  operation with a request body that is opening, fake only once its
  `.responses-wrapper` exists: resolving mounts the body's content-type
  control, which clears the response. The call reports an error otherwise.
- `V.press(key)`: a real, trusted key press (`Tab`, `Shift+Tab`, `Enter`,
  `Escape`, `Space`, arrows), delivered by the runner. Realtime only.
- `V.hover(selector)`: a real pointer moved onto the element's centre, the
  same way. Wait for `element.matches(':hover')` before reading what changes.
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
- `V.rules(selector, property)`: every stylesheet rule that matches the
  element and declares a property matching the pattern, in source order, with
  the layer or media it sits in. The answer to "why does this value not take",
  which each time was a rule nobody was looking at: a stock rule, a later rule
  of equal specificity, a stock minimum a rewrite had stopped countering.

Console errors and uncaught exceptions are collected into `errors` on their
own, and a non-empty `errors` fails the run (exit code 1). The script builds
the page, publishes it next to the app's static files, runs it, prints the
log as JSON and removes what it published.

### The regression suite

`python docs/design/verify.py --suite` runs every scenario in
`docs/design/scenarios/`, once per width it declares, three at a time, and
prints one line per run. A scenario declares its settings in its header:
`// @widths 320,1280`, `// @wait 20000`, `// @virtual 40000`,
`// @spec-url /missing`, and `// @alone` for a scenario that sends real
input, keys or the pointer: those run after the parallel batch, one at a
time, because a machine busy with other browsers can drop a trusted event
and the check then fails for a reason that is not the page's. `--only
topbar` narrows it, `--verbose` prints every check. It exits 1 if a check
fails, a console error is logged, or a run produces no checks. Each
scenario records a behaviour that was verified when it shipped, so the
suite is the characterization net under any later change: run it before
and after.

`verify-realtime.js` is the runner underneath: Node 22, the DevTools
protocol over the native WebSocket, a throwaway profile and a free port per
run, and the viewport set through `Emulation.setDeviceMetricsOverride`. It
drives any Chromium: `BROWSER` names the executable, otherwise the first one
installed is used (Edge or Chrome on Windows, Chrome or Chromium on Linux).

`--coverage` adds the Chromium coverage the DevTools Coverage panel uses:
every run records which rules of the theme's parts were applied and which
functions of the console's modules ran, and the suite ends with what no
scenario reached, by file and line. A rule never applied is either dead or
a state no scenario visits; a probe of the real DOM tells the two apart.
The browser reports only the rules it applied, so the total comes from
parsing the stylesheets on disk, and a part no run loaded counts whole. Coverage slows the
page: a scenario that fails only under it is waiting on a clock somewhere.

`mutate.py` goes one step further: it knocks one named function of the
console's modules out at a time (a `return;` as its first statement), serves
the mutated module, and runs only the scenarios whose coverage shows that function
running. A failing run kills the mutant; a green run means the function could
stop working unnoticed. Calibrate it before trusting a score: a function a
scenario is known to check must be killed, and one nothing checks must
survive. Every mutant runs a real suite, so a full pass takes over an hour;
`--only` and `--sample` narrow it. The served script is restored after each
mutant.

CI runs the suite in the `ui-suite` job on every push: the application on
the compose dependencies, headless Chrome, two runs at a time. A failure keeps
the application log as an artifact.

## Pixel comparison

A change that must not alter the rendering is verified by capturing the same
page before and after:

```
set PAGE=(function(){var b=document.body.getBoundingClientRect();return {x:0,y:0,width:Math.ceil(b.width),height:Math.ceil(document.body.scrollHeight)};})()

python docs/design/verify.py docs/design/snapshot.js --width 1280 --out %TEMP%/before --clip "%PAGE%"
...make the change...
python docs/design/verify.py docs/design/snapshot.js --width 1280 --out %TEMP%/after --clip "%PAGE%"
python docs/design/pixdiff.py %TEMP%/before_0.png %TEMP%/after_0.png --ignore-from %TEMP%/after.json
```

`snapshot.js` opens the page in a fixed state and reports the regions the page
generates per load, the timestamps inside schema examples, which `pixdiff`
masks. Calibrate first: two runs of unchanged code must report `identical`. It
executes nothing, because a token or a duration differs between runs and would
read as a regression.

## Matching the design

```
python docs/design/fidelity.py STATE [--only ROLE,...] [--all] [--shots] [--exact] [--base URL]
```

A screenshot says that two pages differ; this says which property of which
element. It opens a reference page from `README.md` from disk and the console
through the harness in the same state and viewport (1440x900), measures every
role in `fidelity-roles.js` on both with `fidelity-probe.js`, and prints each
property that differs, reference value first. Boxes are relative to the
window. A role is a pair of selectors, one per page; `selector|n` picks the
n-th match. A state names the reference page and hash, and the steps the
console takes to reach it, which fake answers and runs where the reference
shows them.

- `--shots` saves both viewports, for `pixdiff.py` to say where pixels still
  differ.
- `--exact` measures boxes to a hundredth of a pixel. Half a pixel moves text
  to another device pixel at 2x and reads as a different glyph; this finds
  which box carries the fraction.
- Text properties are compared only where text is drawn, and a colour mixed
  with `color-mix()` compares equal to the same colour written as `rgba()`.

Differences it cannot remove are the reference's content and pairs of
elements that draw the same thing with different structure; the deliberate
departures are listed in `README.md`.

The runner under it takes `VIEW_H` for the viewport's height and `INJECT` for
a script to run at the start of every document, so a probe can measure a
page that does not load the harness.

Three more settings serve questions a settled page cannot answer. The
browser runs with reduced motion so every state is measured settled;
`MOTION=1` keeps transitions, to measure one in flight. `VIEW_DSF=0.75`
renders at the device scale a 75% browser zoom produces, and
`SHOT_SCALE=1` captures at device pixels, which is how a hairline or a 9px
caption was seen to fade at that zoom rather than argued about. An
`INJECT` that holds `document.fonts.load` keeps the loading placeholders
on screen long enough to capture them.

## Interface inventory

"It does not look like one family" is a feeling until it is counted.
`inventory.js` opens operations, a live response and the schemas, then
lists every distinct corner radius, type size and weight, font family and
border colour the page renders, each with how often it occurs and one
element that uses it:

```
python docs/design/verify.py docs/design/inventory.js --wait 30000
```

A coherent system has few values, and a value that occurs once or twice is
usually a leftover; the example element says where to look. Rem sizes
against the 14px root showed up this way as 11.06px and 10.08px, sizes
nobody chose.

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
- **Virtual time starves `requestAnimationFrame`.** The console repaints
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
- **The harness must style the page as production does.** It once linked
  Swagger's stylesheets outside the theme's cascade layer, and every check ran
  against a cascade no reader is served. `verify.py` now compares the
  stylesheets and inline styles of the harness with the served document's and
  refuses to run when they differ.
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
  to whoever started it. `verify.py --base http://localhost:8081` runs any
  scenario, or the suite, against it.
- **Anything that creates data cleans up after itself**, usually by
  deactivating the tenant it registered.
