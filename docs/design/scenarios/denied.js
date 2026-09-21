// @widths 1280
// A refused call explained where it happens: which credential was missing,
// expired or refused, the way to get it, and the note moving on once
// Authorize holds a working one. Responses are faked; nothing reaches the
// backend. Every step waits for the page, not for a clock.
var noteOf = function (block) { return document.querySelector('#operations-' + block + ' .emit-note[data-state]'); };
var textOf = function (block) { var n = noteOf(block); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; };
var isOpen = function (block) { var b = document.getElementById('operations-' + block); return !!b && b.classList.contains('is-open'); };
var REQUEST_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
var refuse = function (path, method, status, message) {
  V.fakeResponse(path, method, status, { status: status, message: message }, 'http://localhost:8080' + path,
                 { 'x-request-id': REQUEST_ID });
};
var says = function (block, pattern) { return function () { return pattern.test(textOf(block)); }; };
var DOCS = 'Documents-listDocuments';
var TENANTS = 'Tenants-listTenants';

V.open('Documents', 'listDocuments', 3500);
V.until(function () { return isOpen(DOCS); }, function () {
  refuse('/v1/documents', 'get', 401, 'Authentication required.');
  V.until(says(DOCS, /needs TENANT/), missing);
}, 15000);

function missing() {
  check('missing: names the credential', /needs TENANT, and Authorize holds none/.test(textOf(DOCS)), textOf(DOCS));
  check('missing: in the 4xx colour', !!noteOf(DOCS) && noteOf(DOCS).classList.contains('emit-note--denied'));
  var way = noteOf(DOCS) && noteOf(DOCS).querySelector('.emit-note__action');
  check('missing: offers the way to get it', !!way && way.textContent === 'Register a tenant', way && way.textContent);
  var ref = noteOf(DOCS) && noteOf(DOCS).querySelector('.emit-note__ref');
  check('missing: names the request it was refused in',
        !!ref && ref.textContent === 'request 3fa85f64' && ref.dataset.requestId === REQUEST_ID,
        ref && { shown: ref.textContent, id: ref.dataset.requestId });
  if (way) way.click();
  V.until(function () { return isOpen('Tenants-createTenant'); }, function () {
    check('the way opens tenant registration', isOpen('Tenants-createTenant'));
    V.authorize('apiKeyAuth', 'key');
    V.until(says(DOCS, /authorized now/), resolved);
  });
}

function resolved() {
  check('resolved once Authorize holds it', /TENANT is authorized now. Execute again/.test(textOf(DOCS)), textOf(DOCS));
  V.authorize('bearerAuth', V.jwt(-60));
  V.open('Tenants', 'listTenants', 0);
  V.until(function () { return isOpen(TENANTS); }, function () {
    refuse('/v1/tenants', 'get', 401, 'Invalid or expired token.');
    V.until(says(TENANTS, /has expired/), expired);
  });
}

function expired() {
  check('expired: says so', /The ADMIN token has expired/.test(textOf(TENANTS)), textOf(TENANTS));
  var way = noteOf(TENANTS) && noteOf(TENANTS).querySelector('.emit-note__action');
  check('expired: offers to log in again', !!way && way.textContent === 'Log in again', way && way.textContent);
  if (way) way.click();
  V.until(function () { return isOpen('Authentication-login'); }, function () {
    check('logging in again opens login', isOpen('Authentication-login'));
    V.authorize('bearerAuth', V.jwt(3600));
    refuse('/v1/tenants', 'get', 403, 'Tenant management needs an admin token.');
    V.until(says(TENANTS, /refused the ADMIN token/), function () {
      check('refused as sent: quotes the API', /refused the ADMIN token: Tenant management needs an admin token/.test(textOf(TENANTS)),
            textOf(TENANTS));
      done();
    });
  });
}
