// @widths 1280
// A refused call explained where it happens: which credential was missing,
// expired or refused, the way to get it, and the note moving on once
// Authorize holds a working one. Responses are faked; nothing reaches the
// backend.
var noteOf = function (block) { return document.querySelector('#operations-' + block + ' .emit-note[data-state]'); };
var textOf = function (block) { var n = noteOf(block); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; };
var isOpen = function (block) { var b = document.getElementById('operations-' + block); return !!b && b.classList.contains('is-open'); };
var refuse = function (path, method, status, message) {
  V.fakeResponse(path, method, status, { status: status, message: message }, 'http://localhost:8080' + path);
};

V.open('Documents', 'listAll_1', 3500);
setTimeout(function () { refuse('/v1/documents', 'get', 401, 'Authentication required.'); }, 5000);

setTimeout(function () {
  check('missing: names the credential', /needs TENANT, and Authorize holds none/.test(textOf('Documents-listAll_1') || ''), textOf('Documents-listAll_1'));
  check('missing: in the 4xx colour', !!noteOf('Documents-listAll_1') && noteOf('Documents-listAll_1').classList.contains('emit-note--denied'));
  var way = noteOf('Documents-listAll_1') && noteOf('Documents-listAll_1').querySelector('.emit-note__action');
  check('missing: offers the way to get it', !!way && way.textContent === 'Register a tenant', way && way.textContent);
  if (way) way.click();
}, 5800);

setTimeout(function () {
  check('the way opens tenant registration', isOpen('Tenants-create'));
  V.authorize('apiKeyAuth', 'key');
}, 7000);

setTimeout(function () {
  check('resolved once Authorize holds it', /TENANT is authorized now. Execute again/.test(textOf('Documents-listAll_1') || ''), textOf('Documents-listAll_1'));
  V.authorize('bearerAuth', V.jwt(-60));
}, 7800);

V.open('Tenants', 'listAll', 8000);
setTimeout(function () { refuse('/v1/tenants', 'get', 401, 'Invalid or expired token.'); }, 9200);

setTimeout(function () {
  check('expired: says so', /The ADMIN token has expired/.test(textOf('Tenants-listAll') || ''), textOf('Tenants-listAll'));
  var way = noteOf('Tenants-listAll') && noteOf('Tenants-listAll').querySelector('.emit-note__action');
  check('expired: offers to log in again', !!way && way.textContent === 'Log in again', way && way.textContent);
  if (way) way.click();
}, 10000);

setTimeout(function () {
  check('logging in again opens login', isOpen('Authentication-login'));
  V.authorize('bearerAuth', V.jwt(3600));
}, 11200);

setTimeout(function () { refuse('/v1/tenants', 'get', 403, 'Tenant management needs an admin token.'); }, 11600);

setTimeout(function () {
  check('refused as sent: quotes the API', /refused the ADMIN token: Tenant management needs an admin token/.test(textOf('Tenants-listAll') || ''),
        textOf('Tenants-listAll'));
  done();
}, 12400);
