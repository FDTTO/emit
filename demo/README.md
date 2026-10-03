# The live demo

The console on GitHub Pages, with no server behind it.

## Recorded, not rewritten

`export.py` takes everything the demo shows from the running app: the
console page and its assets, the spec, the rate limit and stage timings of
real runs, and a PDF the app rendered. A demo written by hand drifts from
the app the first time either changes. A recorded one is rebuilt from the
app on every push to `main`.

What a page cannot record is behaviour. `api.js` answers the API inside the
page with the app's rules: which credential opens which route, the rolling
rate limit, a document's states and stamps. To keep those rules honest,
`cases.json` lists requests that end in a refusal. `export.py` sends each one
to the real app and stores the answer, and `accept.js` sends the same
requests to the demo. The check fails unless every status and message match,
ids and numbers aside. The same run presses Run all steps and needs the
whole journey done, with no console error.

## Why `fetch` is replaced in the page

A service worker would answer at the network layer, but it only controls a
page after its first load, so the first visit would need a reload. Replacing
`fetch` before Swagger UI loads answers the very first request. Swagger UI
and the console both go through `fetch`, so nothing else is needed.

A document's state is derived from when its generation was requested and the
recorded timings, never scheduled. A reload in the middle of a run still
shows the state it would have reached.

## Running it locally

With the app running on 8080:

```bash
python demo/export.py http://localhost:8080 site
python tools/prumo visit demo/accept.js --serve site --at /emit/ --wait 90000
```

The check serves the site under `/emit/`, as Pages does, so an absolute
path that would break there breaks here first.
