// @widths 1280
// @wait 40000
// Following a document through its lifecycle, with the reads stubbed so
// every outcome is reachable on demand. Each step waits for the note, not a
// clock; the only real waits are the follow's own backoff and Retry-After.
// The stamps of a real run: 11 ms queued in Kafka, 34 ms rendering.
var stamps = { queuedAt: '2026-09-19T12:00:00.000Z', startedAt: '2026-09-19T12:00:00.011Z', finishedAt: '2026-09-19T12:00:00.045Z' };
var plan = {
  done: [{ status: 200, state: 'PROCESSING', stamps: { queuedAt: stamps.queuedAt, startedAt: stamps.startedAt } },
         { status: 200, state: 'DONE', stamps: stamps }],
  limited: [{ status: 429, headers: { 'Retry-After': '2', 'RateLimit-Remaining': '0' } }, { status: 200, state: 'DONE' }],
  saving: [{ status: 200, state: 'PROCESSING', headers: { 'RateLimit-Remaining': '1' } }]
};
var reads = {};
var headersSent = {};
var realFetch = window.fetch;
window.fetch = function (url, options) {
  var m = String(url).match(/^\/v1\/documents\/([^/?]+)$/);
  if (!m) return realFetch.apply(this, arguments);
  var id = m[1];
  reads[id] = (reads[id] || 0) + 1;
  headersSent[id] = options && options.headers;
  var step = plan[id][Math.min(reads[id], plan[id].length) - 1];
  var body = step.state ? JSON.stringify(Object.assign({ id: id, status: step.state }, step.stamps || {})) : '';
  return Promise.resolve(new Response(body,
    { status: step.status, headers: Object.assign({ 'Content-Type': 'application/json' }, step.headers || {}) }));
};
var accepted = function (id) {
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, 'http://localhost:8080/v1/documents/' + id + '/generate', {});
};
var edges = function () {
  return Array.prototype.map.call(document.querySelectorAll('#emit-lifecycle .emit-flow-link'), function (link) { return link.textContent; });
};
var note = function () { return V.text('#operations-Documents-requestDocumentGeneration .emit-note--follow') || ''; };
// The action button (Check again), not any button: the document id is a link button too.
var button = function () { return !!document.querySelector('#operations-Documents-requestDocumentGeneration .emit-note--follow .emit-note__action'); };
var lit = function () { var s = document.querySelector('#emit-lifecycle .is-current .emit-flow-state'); return s && s.textContent; };

var isOpen = function (block) { var b = document.getElementById('operations-' + block); return !!b && b.classList.contains('is-open'); };
var noteSays = function (pattern) { return function () { return pattern.test(note()); }; };

V.until(function () { return !!V.definition('apiKeyAuth'); }, function () {
  V.authorize('apiKeyAuth', 'key');
  V.open('Documents', 'requestDocumentGeneration', 0);
  V.until(function () { return isOpen('Documents-requestDocumentGeneration'); }, function () {
    accepted('done');
    V.until(noteSays(/PENDING/), function () {
      check('follows from PENDING', /PENDING/.test(note()) && /checking/.test(note()), note());
      check('no crossing timed before the worker picks it up', edges().join('|') === 'kafka|render', edges());
      V.until(noteSays(/PROCESSING/), function () {
        check('picked up, the kafka edge says how long it queued, the render edge not yet',
              edges().join('|') === 'kafka11 ms|render', edges());
        V.until(noteSays(/Download PDF/), reachedDone);
      });
    });
  });
}, 15000);

function reachedDone() {
  check('reaches DONE and offers the PDF', /DONE/.test(note()) && /Download PDF/.test(note()), note());
  check('says how long the run took, from the document\'s own stamps', /PDF ready 45 ms after generate/.test(note()), note());
  check('each edge says how long its crossing took', edges().join('|') === 'kafka11 ms|render34 ms', edges());
  check('the figure lights DONE', lit() === 'DONE', lit());
  check('reads send the held key', (headersSent.done || {})['X-API-Key'] === 'key', headersSent.done);
  check('two reads were enough', reads.done === 2, reads.done);
  var named = document.querySelector('#operations-Documents-requestDocumentGeneration .emit-note--follow .emit-note__link');
  check('the document id is a link', !!named && named.textContent === 'done', named && named.textContent);
  if (named) named.click();
  V.until(function () { return isOpen('Documents-getDocument'); }, function () {
    check('the id link opens Get document by ID', isOpen('Documents-getDocument'));
    check('with that id in place', V.param('/v1/documents/{id}', 'get') === 'done', V.param('/v1/documents/{id}', 'get'));
    accepted('limited');
    V.until(noteSays(/resuming in 2s/), rateLimited);
  });
}

function rateLimited() {
  check('a 429 says when it resumes', /resuming in 2s/.test(note()), note());
  check('and needs no button', !button());
  V.until(noteSays(/limited.*DONE/), function () {
    check('it resumes by itself to DONE', /DONE/.test(note()), note());
    accepted('saving');
    V.until(noteSays(/leave your last request/), function () {
      check('it leaves the last request to the reader', /leave your last request this minute/.test(note()), note());
      check('with a way to check again', button());
      check('after one read', reads.saving === 1, reads.saving);
      done();
    });
  });
}
