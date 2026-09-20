// @widths 1280
// Credentials handed on by responses: a held token is offered, not replaced;
// accepting applies it; an empty scheme is filled; a failed login fills
// nothing. The login is real, the tenant response faked.
var LOGIN = 'operations-Authentication-login';
var note = function (block) { return V.text('#' + block + ' .emit-notes'); };

setTimeout(function () { V.authorize('bearerAuth', 'OLD'); }, 3500);
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 4000);

V.until(function () { return !!note(LOGIN); }, function () {
  check('a held token is kept', V.held('bearerAuth') === 'OLD', V.held('bearerAuth'));
  check('and the new one is offered', /already holds a different ADMIN token/.test(note(LOGIN) || ''), note(LOGIN));
  var accept = document.querySelector('#' + LOGIN + ' .emit-note__action');
  if (accept) accept.click();
  setTimeout(acceptedToken, 700);
}, 20000);

function acceptedToken() {
  var token = (V.json('/v1/auth/login', 'post') || {}).token;
  check('accepting applies the response token', !!token && V.held('bearerAuth') === token);
  check('and the note says so', /Authorized as ADMIN with this token/.test(note(LOGIN) || ''), note(LOGIN));
  V.open('Tenants', 'createTenant', 200);
  setTimeout(function () {
    V.fakeResponse('/v1/tenants', 'post', 201, { id: 't-1', apiKey: 'key-1' }, 'http://localhost:8080/v1/tenants');
  }, 1400);
  setTimeout(tenantNote, 2200);
}

function tenantNote() {
  var text = note('operations-Tenants-createTenant') || '';
  check('an empty scheme is filled from the response', V.held('apiKeyAuth') === 'key-1', V.held('apiKeyAuth'));
  check('tenant note: authorized', /Authorized as TENANT with this key/.test(text), text);
  check('tenant note: id carried in page order',
        /Filled this id into Get tenant by ID, Deactivate tenant and Reactivate tenant/.test(text), text);
  V.fakeResponse('/v1/auth/login', 'post', 401, { status: 401, message: 'Invalid credentials' }, 'http://localhost:8080/v1/auth/login');
  setTimeout(function () {
    check('a failed login leaves no note', !document.querySelector('#' + LOGIN + ' .emit-notes'), note(LOGIN));
    done();
  }, 800);
}
