// @widths 1280
// @wait 20000
// Following a document through its lifecycle, with the reads stubbed so
// every outcome is reachable on demand.
var plan = {
  done: [{ status: 200, state: 'PROCESSING' }, { status: 200, state: 'DONE' }],
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
  return Promise.resolve(new Response(step.state ? JSON.stringify({ id: id, status: step.state }) : '',
    { status: step.status, headers: Object.assign({ 'Content-Type': 'application/json' }, step.headers || {}) }));
};
var accepted = function (id) {
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, 'http://localhost:8080/v1/documents/' + id + '/generate');
};
var note = function () { return V.text('#operations-Documents-generate .emit-note--follow') || ''; };
// The action button (Check again), not any button: the document id is a link button too.
var button = function () { return !!document.querySelector('#operations-Documents-generate .emit-note--follow .emit-note__action'); };
var lit = function () { var s = document.querySelector('#emit-lifecycle .is-current .emit-flow-state'); return s && s.textContent; };

setTimeout(function () { V.authorize('apiKeyAuth', 'key'); }, 3000);
V.open('Documents', 'generate', 3200);

setTimeout(function () { accepted('done'); }, 5000);
setTimeout(function () {
  var named = document.querySelector('#operations-Documents-generate .emit-note--follow .emit-note__link');
  check('the document id is a link', !!named && named.textContent === 'done', named && named.textContent);
  if (named) named.click();
}, 8400);
setTimeout(function () {
  check('follows from PENDING', /PENDING/.test(note()) && /checking/.test(note()), note());
}, 5500);
setTimeout(function () {
  check('reaches DONE and offers the PDF', /DONE/.test(note()) && /Download PDF/.test(note()), note());
  check('the figure lights DONE', lit() === 'DONE', lit());
  check('reads send the held key', (headersSent.done || {})['X-API-Key'] === 'key', headersSent.done);
  check('two reads were enough', reads.done === 2, reads.done);
  var read = document.getElementById('operations-Documents-findById_1');
  check('the id link opens Get document by ID', !!read && read.classList.contains('is-open'));
  check('with that id in place', V.param('/v1/documents/{id}', 'get') === 'done', V.param('/v1/documents/{id}', 'get'));
  accepted('limited');
}, 9000);

setTimeout(function () {
  check('a 429 says when it resumes', /resuming in 2s/.test(note()), note());
  check('and needs no button', !button());
}, 10500);
setTimeout(function () {
  check('it resumes by itself to DONE', /DONE/.test(note()), note());
  accepted('saving');
}, 14500);

setTimeout(function () {
  check('it leaves the last request to the reader', /leave your last request this minute/.test(note()), note());
  check('with a way to check again', button());
  check('after one read', reads.saving === 1, reads.saving);
  done();
}, 16500);
