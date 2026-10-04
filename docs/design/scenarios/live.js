// @widths 1280
// @wait 30000
// The cockpit's live parts, driven by stored responses and stubbed reads:
// the journey advances as credentials and answers arrive, the rail's live
// card follows the run to DONE and offers the PDF, each operation's row and
// map entry remember the last answer, and the statusbar carries the budget,
// the status and the request id of the latest one.
const ID = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20';
let reads = 0;
const realFetch = window.fetch;
window.fetch = function (url, init) {
  if (String(url) !== '/v1/documents/' + ID) return realFetch.call(this, url, init);
  reads++;
  const state = reads < 2 ? 'PROCESSING' : 'DONE';
  const stamps = { queuedAt: '2026-09-19T12:00:00.000Z', startedAt: '2026-09-19T12:00:00.011Z' };
  if (state === 'DONE') stamps.finishedAt = '2026-09-19T12:00:00.045Z';
  return Promise.resolve(new Response(JSON.stringify(Object.assign({ id: ID, status: state }, stamps)),
    { status: 200, headers: { 'Content-Type': 'application/json', 'RateLimit-Remaining': '15' } }));
};
const q = function (selector) { return document.querySelector(selector); };
const seen = function (node) { if (!node) return false; const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const count = function () { return (V.text('.emit-journey__count') || '').trim(); };

V.until(function () { return !!q('.emit-journey__count') && !!V.definition('apiKeyAuth') && !!q('.opblock'); }, function () {
  check('nothing running, no live card', !seen(q('#emit-live')));
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'key');
  V.until(function () { return count() === '2 / 5'; }, function () {
    check('credentials held: two steps done', count() === '2 / 5', count());
    check('the next step is creating a document', /Create a document/.test(V.text('.emit-journey__step') || ''), V.text('.emit-journey__step'));

    V.fakeResponse('/v1/documents', 'post', 201, { id: ID, title: 'Q3', status: 'PENDING' }, 'http://localhost:8080/v1/documents',
                   { 'x-request-id': '8c1f3e2a-6b7d-4f10-9c55-2e8a1b4d07a2', 'ratelimit-limit': '20', 'ratelimit-remaining': '17' });
    V.until(function () { return count() === '3 / 5'; }, function () {
      const row = q('#operations-Documents-createDocument .emit-last');
      check('the row remembers the answer', !!row && /201/.test(row.textContent), row && row.textContent);
      check('so does the map', !!q('.emit-map__item[data-target="operations-Documents-createDocument"] .emit-map__ran.is-ok'));
      check('the statusbar names status and budget', /Last 201/.test(V.text('#emit-status-last') || '')
        && /RateLimit 17 \/ 20/.test(V.text('#emit-status-budget') || ''), [V.text('#emit-status-last'), V.text('#emit-status-budget')]);
      check('and the request id, shortened', /X-Request-Id 8c1f…a2/.test(V.text('#emit-status-request') || ''), V.text('#emit-status-request'));
      V.open('Documents', 'getDocument', 0);
      V.until(function () { return seen(q('#operations-Documents-getDocument .emit-carried')); }, generate, 8000);
    }, 8000);
  }, 8000);
}, 20000);

function generate() {
  const chip = q('#operations-Documents-getDocument .emit-carried');
  check('the carried id names its source in the field', seen(chip) && chip.textContent === 'from Create document', chip && chip.textContent);
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, 'http://localhost:8080/v1/documents/' + ID + '/generate', {});
  V.until(function () { return seen(q('#emit-live')); }, function () {
    check('a run shows the live card', seen(q('#emit-live')) && /31f7dfab/.test(V.text('#emit-live') || ''));
    V.until(function () { return !!q('#emit-live .emit-live__action'); }, function () {
      check('it follows the run to DONE', !!q('#emit-live .emit-live__stage.is-good'));
      check('and offers the PDF', /Download PDF/.test(V.text('#emit-live .emit-live__action') || ''));
      const spans = Array.prototype.map.call(document.querySelectorAll('#emit-live .emit-live__span'), function (s) { return s.textContent; });
      check('the card times each crossing, over the line between its stages', spans.join('|') === '11 ms|34 ms', spans);
      check('and, ended, says how long the run took on the server, not how long it was watched',
            V.text('#emit-live .emit-live__elapsed') === '45 ms', V.text('#emit-live .emit-live__elapsed'));
      check('the journey counts the run', count() === '4 / 5', count());
      check('the budget outlives an answer that does not carry it', /RateLimit 17 \/ 20/.test(V.text('#emit-status-budget') || ''), V.text('#emit-status-budget'));
      check('and points at the download', /Download the PDF/.test(V.text('.emit-journey__step') || ''), V.text('.emit-journey__step'));
      done();
    }, 15000);
  }, 8000);
}
