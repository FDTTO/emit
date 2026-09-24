// @widths 1280
// @wait 30000
// The cockpit's live parts, driven by stored responses and stubbed reads:
// the journey advances as credentials and answers arrive, the rail's live
// card follows the run to DONE and offers the PDF, each operation's row and
// map entry remember the last answer, and the statusbar carries the budget,
// the status and the request id of the latest one.
var ID = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20';
var reads = 0;
var realFetch = window.fetch;
window.fetch = function (url) {
  if (String(url) !== '/v1/documents/' + ID) return realFetch.apply(this, arguments);
  reads++;
  var state = reads < 2 ? 'PROCESSING' : 'DONE';
  return Promise.resolve(new Response(JSON.stringify({ id: ID, status: state, updatedAt: '2026-09-19T12:00:07.600Z' }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'RateLimit-Remaining': '15' } }));
};
var q = function (selector) { return document.querySelector(selector); };
var seen = function (node) { if (!node) return false; var r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
var count = function () { return (V.text('.emit-journey__count') || '').trim(); };

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
      var row = q('#operations-Documents-createDocument .emit-last');
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
  var chip = q('#operations-Documents-getDocument .emit-carried');
  check('the carried id names its source in the field', seen(chip) && chip.textContent === 'from Create document', chip && chip.textContent);
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, 'http://localhost:8080/v1/documents/' + ID + '/generate',
                 { date: ['Sat', '19 Sep 2026 12:00:00 GMT'] });
  V.until(function () { return seen(q('#emit-live')); }, function () {
    check('a run shows the live card', seen(q('#emit-live')) && /31f7dfab/.test(V.text('#emit-live') || ''));
    V.until(function () { return !!q('#emit-live .emit-live__action'); }, function () {
      check('it follows the run to DONE', !!q('#emit-live .emit-live__stage.is-good'));
      check('and offers the PDF', /Download PDF/.test(V.text('#emit-live .emit-live__action') || ''));
      check('the journey counts the run', count() === '4 / 5', count());
      check('the budget outlives an answer that does not carry it', /RateLimit 17 \/ 20/.test(V.text('#emit-status-budget') || ''), V.text('#emit-status-budget'));
      check('and points at the download', /Download it/.test(V.text('.emit-journey__step') || ''), V.text('.emit-journey__step'));
      done();
    }, 15000);
  }, 8000);
}
