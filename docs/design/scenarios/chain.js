// @widths 1280
// @wait 30000
// Generating a document that is already DONE is refused with a 409, and that
// refusal is still news: the page reads the document, says it was already
// generated and offers its PDF, and the walkthrough counts the generation as
// done. A document's later steps prove the earlier ones.
const DOC = '9e4c2a1b-7d5f-4b3a-8e6c-1a2b3c4d5e6f';
const stamps = { queuedAt: '2026-09-19T12:00:00.000Z', startedAt: '2026-09-19T12:00:00.012Z', finishedAt: '2026-09-19T12:00:00.043Z' };
const realFetch = window.fetch;
window.fetch = function (url, init) {
  if (String(url).replace(/^https?:\/\/[^/]+/, '') !== '/v1/documents/' + DOC) return realFetch.call(this, url, init);
  return Promise.resolve(new Response(JSON.stringify(Object.assign({ id: DOC, status: 'DONE' }, stamps)),
    { status: 200, headers: { 'Content-Type': 'application/json' } }));
};
const note = function () { return V.text('#operations-Documents-requestDocumentGeneration .emit-note--follow') || ''; };
const count = function () { return (V.text('.emit-journey__count') || '').trim(); };
const next = function () { return V.text('.emit-journey__step') || ''; };

V.until(function () { return !!V.definition('apiKeyAuth') && !!document.querySelector('.emit-journey__count'); }, function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'key');
  V.open('Documents', 'requestDocumentGeneration', 0);
  V.until(function () { return !!document.querySelector('#operations-Documents-requestDocumentGeneration .responses-wrapper'); }, function () {
    V.fakeResponse('/v1/documents/{id}/generate', 'post', 409,
                   { status: 409, message: 'Document must be PENDING but is DONE: ' + DOC, timestamp: '2026-09-19T12:01:00Z' },
                   'http://localhost:8080/v1/documents/' + DOC + '/generate', {});
    V.until(function () { return /Already generated/.test(note()); }, function () {
      check('a 409 for a DONE document says it was already generated, with the run\'s time',
            /Already generated: PDF ready 43 ms after generate/.test(note()), note());
      check('and offers its PDF', !!document.querySelector('#operations-Documents-requestDocumentGeneration .emit-note--follow .emit-note__action'));
      V.until(function () { return count() === '4 / 5'; }, function () {
        check('the walkthrough counts it generated, and the document created with it', count() === '4 / 5', count());
        check('the next step is the download', /Download the PDF/.test(next()), next());
        V.fakeResponse('/v1/documents/{id}/pdf', 'get', 200, null, 'http://localhost:8080/v1/documents/' + DOC + '/pdf',
                       { 'content-type': 'application/pdf' });
        V.until(function () { return count() === '5 / 5'; }, function () {
          check('downloaded, the walkthrough is done', count() === '5 / 5', count());
          V.logoutHeld();
          done();
        }, 8000);
      }, 8000);
    }, 8000);
  }, 15000);
}, 20000);
