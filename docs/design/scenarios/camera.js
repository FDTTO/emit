// @widths 1280
// @wait 60000
// While Run all steps runs, the page follows the step being run, until the
// reader scrolls: then the camera is theirs and the page stops moving under
// them, while the run goes on to the end. Follow hands it back. The API is
// answered here, as in journey.js.
const DOC = '5b2e7c1a-9d3f-4a6b-8c1e-2f4a6b8d0c1e';
const reply = function (status, body, type) {
  return Promise.resolve(new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body),
    { status: status, headers: { 'Content-Type': type || 'application/json' } }));
};
const realFetch = window.fetch;
window.fetch = function (url, init) {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  const method = String((init && init.method) || 'GET').toUpperCase();
  if (method === 'POST' && path === '/v1/auth/login') return reply(200, { token: V.jwt(3600) });
  if (method === 'POST' && path === '/v1/tenants') return reply(201, { id: 'a1b2c3d4-0000-4000-8000-000000000002', name: 'Camera', schemaName: 'camera', apiKey: 'emit_camera_key', active: true });
  if (method === 'POST' && path === '/v1/documents') return reply(201, { id: DOC, title: 'Q3 Invoice', status: 'PENDING', createdAt: new Date().toISOString() });
  if (method === 'POST' && path === '/v1/documents/' + DOC + '/generate') return reply(202, null);
  if (method === 'GET' && path === '/v1/documents/' + DOC) return reply(200, { id: DOC, status: 'DONE', createdAt: new Date().toISOString() });
  if (method === 'GET' && path === '/v1/documents/' + DOC + '/pdf') return reply(200, '%PDF-1.4 camera', 'application/pdf');
  return realFetch.call(this, url, init);
};
const pane = function () { return document.querySelector('#emit-window .swagger-container > .swagger-ui'); };
const camera = function () { return document.querySelector('.emit-journey__camera'); };
const count = function () { return (V.text('.emit-journey__count') || '').trim(); };

V.until(function () { return !!document.querySelector('.emit-journey-run') && !!V.definition('bearerAuth'); }, function () {
  V.logoutHeld();
  check('idle, the rail offers to run the steps and holds no camera',
        /Run all steps/.test(V.text('.emit-journey__run') || '') && camera().hidden);
  pane().scrollTop = 0;
  document.querySelector('.emit-journey-run').click();
  V.until(function () { return pane().scrollTop > 0 && camera().getAttribute('aria-pressed') === 'true'; }, function () {
    check('running, the page follows the step being run', pane().scrollTop > 0 && /Following/.test(camera().textContent), pane().scrollTop);
    pane().dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
    V.until(function () { return camera().getAttribute('aria-pressed') === 'false'; }, function () {
      check('a scroll of the reader\'s own frees the camera', /Follow$/.test(camera().textContent.trim()), camera().textContent);
      pane().scrollTop = 0;
      V.until(function () { return count() === '5 / 5' && document.querySelector('.emit-journey__tools').hidden; }, function () {
        check('free, the run goes on to the end without moving the page', pane().scrollTop === 0, pane().scrollTop);
        check('finished, the rail keeps no run controls', document.querySelector('.emit-journey__tools').hidden);
        V.logoutHeld();
        done();
      }, 40000);
    }, 3000);
  }, 10000);
}, 20000);
