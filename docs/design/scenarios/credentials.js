// @widths 1280
// Credentials handed on by responses: a held token is offered, not replaced;
// accepting applies it; an empty scheme is filled; a failed login fills
// nothing. The login is real, the tenant response faked. Each step waits for
// what it checks, not for a clock.
var LOGIN = 'operations-Authentication-login';
var TENANT = 'operations-Tenants-createTenant';
var note = function (block) { return V.text('#' + block + ' .emit-notes') || ''; };
var isOpen = function (id) { var b = document.getElementById(id); return !!b && b.classList.contains('is-open'); };
// A real response can only arrive once the operation's body, with its
// Execute button, has rendered; a fake that lands earlier has no live
// response section to show a note in.
var bodyReady = function (id) { var b = document.getElementById(id); return isOpen(id) && !!(b && b.querySelector('.responses-wrapper')); };

V.until(function () { return !!V.definition('bearerAuth'); }, function () {
  V.authorize('bearerAuth', 'OLD');
  V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 0);
  V.until(function () { return !!note(LOGIN); }, offered, 25000);
}, 20000);

function offered() {
  check('a held token is kept', V.held('bearerAuth') === 'OLD', V.held('bearerAuth'));
  check('and the new one is offered', /already holds a different ADMIN token/.test(note(LOGIN)), note(LOGIN));
  var accept = document.querySelector('#' + LOGIN + ' .emit-note__action');
  if (accept) accept.click();
  V.until(function () { return /Authorized as ADMIN with this token/.test(note(LOGIN)); }, accepted);
}

function accepted() {
  var token = (V.json('/v1/auth/login', 'post') || {}).token;
  check('accepting applies the response token', !!token && V.held('bearerAuth') === token);
  check('and the note says so', /Authorized as ADMIN with this token/.test(note(LOGIN)), note(LOGIN));
  V.open('Tenants', 'createTenant', 0);
  V.until(function () { return bodyReady(TENANT); }, function () {
    V.fakeResponse('/v1/tenants', 'post', 201, { id: 't-1', apiKey: 'key-1' }, 'http://localhost:8080/v1/tenants');
    V.until(function () { return /Filled this id/.test(note(TENANT)); }, tenantNote);
  });
}

function tenantNote() {
  var text = note(TENANT);
  check('an empty scheme is filled from the response', V.held('apiKeyAuth') === 'key-1', V.held('apiKeyAuth'));
  check('tenant note: authorized', /Authorized as TENANT with this key/.test(text), text);
  check('tenant note: id carried in page order',
        /Filled this id into Get tenant by ID, Deactivate tenant and Reactivate tenant/.test(text), text);
  V.fakeResponse('/v1/auth/login', 'post', 401, { status: 401, message: 'Invalid credentials' }, 'http://localhost:8080/v1/auth/login');
  V.until(function () { return !document.querySelector('#' + LOGIN + ' .emit-notes'); }, function () {
    check('a failed login leaves no note', !document.querySelector('#' + LOGIN + ' .emit-notes'), note(LOGIN));
    done();
  });
}
