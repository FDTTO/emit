// @widths 1280
// @wait 40000
// Following a document through its lifecycle, with the reads stubbed so
// every outcome is reachable on demand. Each step waits for the note, not a
// clock; the only real waits are the follow's own backoff and Retry-After.
var plan = {
  done: [{ status: 200, state: 'PROCESSING' }, { status: 200, state: 'DONE', updatedAt: '2026-09-19T12:00:07.600Z' }],
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
  return Promise.resolve(new Response(step.state ? JSON.stringify({ id: id, status: step.state, updatedAt: step.updatedAt }) : '',
    { status: step.status, headers: Object.assign({ 'Content-Type': 'application/json' }, step.headers || {}) }));
};
// The 202 carries the server's Date, split on its comma the way Swagger
// stores real headers; the run is timed from it to updatedAt at DONE.
var accepted = function (id) {
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, 'http://localhost:8080/v1/documents/' + id + '/generate',
                 { date: ['Sat', '19 Sep 2026 12:00:00 GMT'] });
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
      V.until(noteSays(/Download PDF/), reachedDone);
    });
  });
}, 15000);

function reachedDone() {
  check('reaches DONE and offers the PDF', /DONE/.test(note()) && /Download PDF/.test(note()), note());
  check('says how long the run took, on the server clock', /PDF ready about 7s after generate/.test(note()), note());
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
