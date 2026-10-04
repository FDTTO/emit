// What the fidelity states share. Each state runs once the console has
// booted: the description read and the rail's map drawn.
const booted = function (then) {
  V.until(function () { return !!V.definition('bearerAuth') && !!document.querySelector('.emit-map__item'); }, then, 20000);
};
// The answers the mockup shows as already given: the dots in the map, the
// last result on each row, the statusbar's telemetry. The latest one last.
const replay = function () {
  const id = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20';
  V.fakeResponse('/v1/auth/login', 'post', 200, { token: V.jwt(3600) }, '/v1/auth/login', {}, 142);
  V.fakeResponse('/v1/tenants', 'post', 201, { id: id, name: 'acme', apiKey: 'emit_fidelity' }, '/v1/tenants', {}, 480);
  V.fakeResponse('/v1/documents/{id}', 'get', 404, { status: 404, message: 'Document not found: ' + id }, '/v1/documents/' + id, {}, 12);
  V.fakeResponse('/v1/documents', 'post', 201, { id: id, title: 'Q3 Invoice', status: 'PENDING' }, '/v1/documents',
    { 'ratelimit-limit': '20', 'ratelimit-remaining': '17', 'x-request-id': '8c1f3e2a-6b7d-4f10-9c55-2e8a1b4d07a2' }, 36);
};
// The mockup's idle and run states show Request PDF generation open, the
// created id carried into it. Operations open closed by default, so it is
// opened, and measured once resolved and filled.
const openGenerate = function (then) {
  V.open('Documents', 'requestDocumentGeneration', 0);
  V.until(function () {
    return !!document.querySelector('#operations-Documents-requestDocumentGeneration .responses-wrapper')
      && !!document.querySelector('#operations-Documents-requestDocumentGeneration .emit-carried');
  }, then, 10000);
};
// Scrolls the content pane so an operation's top meets the pane's, as the
// mockups show an open one.
const bringToTop = function (id, below) {
  const block = document.getElementById(id), pane = block.closest('.swagger-ui');
  pane.scrollTop += block.getBoundingClientRect().top - pane.getBoundingClientRect().top - (below || 0);
};
// A run in progress: the document's reads answer with the given state, and
// the 202 that starts the follow arrives now.
const running = function (state) {
  const id = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20', realFetch = window.fetch;
  window.fetch = function (url, init) {
    if (String(url).indexOf('/v1/documents/' + id) !== -1 && !/generate|pdf/.test(String(url))) {
      return Promise.resolve(new Response(JSON.stringify({ id: id, status: state }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.call(this, url, init);
  };
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, location.origin + '/v1/documents/' + id + '/generate',
    { date: new Date(Date.now() - 1400).toUTCString().split(',') }, 38);
};
