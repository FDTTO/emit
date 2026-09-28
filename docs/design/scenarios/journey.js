// @widths 1280
// @wait 60000
// Run all steps drives the walkthrough the way a reader would: each step
// not yet done, in order, opened, filled and executed, the next one only
// once the page sees this one done, the tenant under a fresh name. The API
// is answered here, so the run touches no database. A step that is refused
// stops the run where it is.
var DOC = '7c1e0f5a-3b2d-4e8f-9a6b-1d2c3e4f5a6b';
var reads = 0;
var refuseDocument = false;
var tenantBodies = [];
var reply = function (status, body, type) {
  return Promise.resolve(new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body),
    { status: status, headers: { 'Content-Type': type || 'application/json', 'X-Request-Id': 'journey-' + status } }));
};
var realFetch = window.fetch;
window.fetch = function (url, options) {
  var path = String(url).replace(/^https?:\/\/[^/]+/, '');
  var method = String((options && options.method) || 'GET').toUpperCase();
  if (method === 'POST' && path === '/v1/auth/login') return reply(200, { token: V.jwt(3600) });
  if (method === 'POST' && path === '/v1/tenants') {
    tenantBodies.push(JSON.parse(options.body));
    return reply(201, { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Journey', schemaName: 'journey', apiKey: 'emit_journey_key', active: true });
  }
  if (method === 'POST' && path === '/v1/documents') {
    if (refuseDocument) return reply(400, { status: 400, message: 'title: must not be blank', timestamp: new Date().toISOString() });
    return reply(201, { id: DOC, title: 'Q3 Invoice', status: 'PENDING', createdAt: new Date().toISOString() });
  }
  if (method === 'POST' && path === '/v1/documents/' + DOC + '/generate') return reply(202, null);
  if (method === 'GET' && path === '/v1/documents/' + DOC) {
    reads++;
    return reply(200, { id: DOC, title: 'Q3 Invoice', status: reads < 2 ? 'PROCESSING' : 'DONE', createdAt: new Date().toISOString() });
  }
  if (method === 'GET' && path === '/v1/documents/' + DOC + '/pdf') return reply(200, '%PDF-1.4 journey', 'application/pdf');
  return realFetch.apply(this, arguments);
};
var run = function () { return document.querySelector('.emit-journey-run'); };
var count = function () { return document.querySelector('.emit-journey__count').textContent; };

V.until(function () { return !!run() && !!V.definition('bearerAuth'); }, function () {
  V.logoutHeld();
  check('the walkthrough offers to run its steps', /Run all steps/.test(run().textContent) && !run().hidden);
  refuseDocument = true;
  run().click();
  V.until(function () { return /Stop/.test(run().textContent); }, function () {
    check('while it runs, the control stops it and the rail says so',
          /Stop/.test(run().textContent) && document.querySelector('.emit-journey__kind').textContent === 'Running');
    V.until(function () { return /Run all steps/.test(run().textContent); }, refused, 25000);
  }, 3000);
}, 20000);

function refused() {
  check('a refused step stops the run on it, the steps before it done',
        count() === '2 / 5' && !!document.querySelector('#operations-Documents-createDocument.is-open .emit-result'), count());
  check('the tenant was created under a fresh name that fits its schema rule',
        tenantBodies.length === 1 && /^journey_[a-z0-9]+$/.test(tenantBodies[0].schemaName), tenantBodies);
  refuseDocument = false;
  run().click();
  V.until(function () { return count() === '5 / 5'; }, function () {
    check('run again, it picks up where it stopped and finishes the walkthrough', count() === '5 / 5' && tenantBodies.length === 1);
    V.until(function () { return run().hidden; }, function () {
      check('with everything done the control steps aside', run().hidden);
      V.logoutHeld();
      done();
    }, 5000);
  }, 45000);
}
