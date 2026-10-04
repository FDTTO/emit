// @widths 375
// On a phone the run's pill ends where the run does: done, it hands over the
// PDF, a button a thumb can take. The drawer's foot reads its telemetry on a
// line and keeps its two tools side by side.
const DOC = '2c4e6a8b-1d3f-4b5a-9c7e-0a1b2c3d4e5f';
const stamps = { queuedAt: '2026-09-19T12:00:00.000Z', startedAt: '2026-09-19T12:00:00.011Z', finishedAt: '2026-09-19T12:00:00.045Z' };
const realFetch = window.fetch;
window.fetch = function (url, init) {
  if (String(url).replace(/^https?:\/\/[^/]+/, '') !== '/v1/documents/' + DOC) return realFetch.call(this, url, init);
  return Promise.resolve(new Response(JSON.stringify(Object.assign({ id: DOC, status: 'DONE' }, stamps)),
    { status: 200, headers: { 'Content-Type': 'application/json' } }));
};
const pill = function () { return document.getElementById('emit-live-pill'); };

V.until(function () { return !!V.definition('apiKeyAuth') && !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  V.authorize('apiKeyAuth', 'key');
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, location.origin + '/v1/documents/' + DOC + '/generate', {}, 38);
  V.until(function () { return !!pill() && /DONE/.test(pill().textContent); }, function () {
    const action = pill().querySelector('.emit-live-pill__action');
    const box = action && action.getBoundingClientRect();
    check('done, the pill offers the PDF as a button', !!action && /PDF/.test(action.textContent) && box.height >= 24, box && box.height);
    check('and the run\'s own time', /45 ms/.test(pill().textContent), pill().textContent);
    action.click();
    V.until(function () { const b = document.getElementById('operations-Documents-downloadDocumentPdf'); return !!b && b.classList.contains('is-open'); }, function () {
      check('which opens Download PDF for that document', V.param('/v1/documents/{id}/pdf', 'get') === DOC, V.param('/v1/documents/{id}/pdf', 'get'));
      document.querySelector('.emit-menu').click();
      setTimeout(function () {
        const density = document.getElementById('emit-density').getBoundingClientRect();
        const legend = document.getElementById('emit-legend-btn').getBoundingClientRect();
        check('the drawer keeps its two tools side by side', Math.abs(density.top - legend.top) < 1 && density.right <= legend.left,
              { density: [density.top, density.right], legend: [legend.top, legend.left] });
        V.logoutHeld();
        done();
      }, 900);
    }, 6000);
  }, 10000);
}, 20000);
