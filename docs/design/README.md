# Design reference

## The cockpit

The console at `/swagger-ui/index.html` is drawn to two reference pages in this
folder. Open them in a browser: they are standalone, with no build step and
no dependencies beyond two webfonts.

- `cockpit-mockup.html`: the window itself. The rail with the walkthrough and
  the map, the titlebar, the statusbar, the overview with the document
  lifecycle, and operations closed and open. Its hash picks a state: `#idle`,
  `#run` (a document being followed), `#op` (an operation open at the top),
  `#rows`.
- `cockpit-surfaces.html`: everything the window shows in other moments. The
  result of a call, the request body editor, a call that got no answer, the
  page loading, the credentials dialog, the schemas, a description that did
  not load, the legend, and the phone. The hash picks one: `#result`,
  `#body`, `#unreachable`, `#loading`, `#auth`, `#schemas`, `#failure`,
  `#legend`, `#phone`.
- `cockpit-system.css`: the one system both are built from. Every component
  uses its tokens and nothing else: five text steps, four radii, one type
  scale in whole pixels, a 4px spacing grid, two faces.

These pages are the specification. `src/main/resources/static/swagger/theme.css`
and `enhance.js` reproduce them on top of the markup Swagger UI renders, so
when the two disagree, the reference is right and the implementation is
wrong. A change to the console starts here.

## The rules they encode

**Colour means outcome, never structure.** Green, amber and red are spent only
on results: a status, a terminal document state. Amber means wait, then retry:
a 429, a server error, a document still pending. HTTP methods share one
desaturated steel family and are told apart by their label, so the green of a
`POST` never sits beside the green of a `201` meaning something else.

**Interaction has one colour of its own.** The brand cyan marks what can be
acted on and where the reader is: the next step, the current place in the
map, a tab, focus. It is the only saturated colour at rest.

**Shape means category.** A square chip is what a value is, a round one how it
is written or who may call; dim text behind a bullet is a rule it must meet;
required is a red mark on the name.

**Monospace means machine output.** Paths, payloads, headers, identifiers and
telemetry are mono. Words written for a reader are set in the grotesque.

**A figure shows mechanism.** The lifecycle earns its place by showing that a
document is persisted before it is queued, that Kafka sits between acceptance
and work, and that the two outcomes are exclusive. While a run is followed it
is also the andon: the document's id rides on the stage it is in, and light
travels the edge it is crossing.

**Density is solved by hierarchy, not by cutting.** Everything the console
knows stays on the page; what is not needed now waits one step away. A
response is a row until chosen, a refusal every route shares is one row with
its causes, the headers most answers carry are said once.

**One family of components.** Glass over a monochrome light: the window is a
first sheet, an open operation or a dialog a second, lit from above; machine
output sits in a dark well. Nothing is drawn that is not built from the
system's tokens.

**One primary action, and it does not shout.** Execute and Authorize are
cyan ink on glass, the material of the rail's next step. Nothing in them
glows harder than anything else on the page; they stand out by colour and
by being the only filled control in their row.

**An open operation is a window.** Its header docks under the titlebar
while its body scrolls, and its action bar, what the call sends, the key
that sends it and Execute, docks at the bottom once the operation fills
the view. In its place the bar is a plain row with room around it.

## What the pages describe in words

Some of the console is behaviour a static page cannot show well. It is
specified here, and each item has a scenario in `scenarios/`.

- **Density.** Compact is the same page in whole pixels on tighter
  spacing: a 40px titlebar and 24px statusbar, a 232px rail, 20px panel
  insets, 40px operation rows, 13px reading text unchanged. It starts on
  its own under 820px of height; the statusbar switches it and the choice
  is remembered. Below 0.8 device pixels per CSS pixel, a browser zoomed
  out, the smallest type steps and the hairlines rise a step.
- **Loading.** Placeholders hold the window until the description, the
  rail's map and both faces are in, never longer than eight seconds; the
  lifecycle's placeholder boots stage by stage; the content then rises in
  turn and a glint runs the window's rim. Swagger's own spinners never
  show: a resolving operation holds two lines, a call that is out holds
  the shape of its result in place of the stale one.
- **The palette.** Ctrl+K lists actions and operations, each group
  labelled, each action saying what it would do now.
- **The keyboard.** J and K walk the operations, Enter opens one, Ctrl+Enter
  executes the operation at hand. Never while typing or with a dialog open.
- **Run all steps.** The walkthrough runs itself: each step not done, in
  order, the next only once the page sees this one done, the tenant under
  a fresh name; the first step not done stops it on that operation.
- **Recent calls.** Each operation keeps its last five calls in the page
  only, never in storage; Load puts a body back in the editor.
- **The server light.** Green while `/actuator/health` answers healthy;
  amber with "not answering" or "not healthy", the part that is down on
  hover.
- **The map follows.** When the place it marks leaves its own view, the
  map scrolls just enough to show it again.

## Checking the console against it

```
python docs/design/fidelity.py STATE [--only ROLE,...] [--shots] [--exact] [--base URL]
```

opens a reference page and the console in the same state and viewport,
measures each pair of elements named in `fidelity-roles.js`, and prints every
property that differs, reference value first. `--shots` also saves both
screenshots for `pixdiff.py`. The states are those of the two pages. See
`VERIFY.md` for the rest of the tooling.

## Where the console departs from them, on purpose

- **Which answer opens by default.** An operation that sends nothing opens its
  success row on its example (`#op`); one with a request body keeps its rows
  closed, since its editor already fills the view (`#body`).
- **The capsule's height.** Holding nothing, the capsule is the quiet
  Authorize pill `#failure` draws, at the height it keeps when it holds
  credentials, so the bar does not move when one arrives.
- **The phone's top.** `#phone` draws the page inside a device frame that
  reserves room for the phone's own status bar. A page in a browser starts
  below it, so the bar starts at the top.
- **Content.** The references show plausible data. The console shows what the
  API and its description say: its own status codes, messages and models.
