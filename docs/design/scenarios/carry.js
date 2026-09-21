// @widths 1280
// A created id carried into the operations that take it: never over a value
// the reader typed, replacing only its own, with the operation names as
// links. Responses are faked; nothing reaches the backend. Each step waits
// for what it checks, not for a clock.
var created = function (id) {
  V.fakeResponse('/v1/documents', 'post', 201, { id: id, status: 'PENDING' }, 'http://localhost:8080/v1/documents');
};
var own = function (path, method, value) {
  var parameter = ui.specSelectors.specJson().getIn(['paths', path, method, 'parameters'])
    .find(function (p) { return p.get('name') === 'id'; });
  ui.specActions.changeParamByIdentity([path, method], parameter, value);
};
var isOpen = function (id) { var b = document.getElementById(id); return !!b && b.classList.contains('is-open'); };
// Fake the response only once the body with its Execute button has rendered,
// the earliest a real one could arrive.
var bodyReady = function (id) { var b = document.getElementById(id); return isOpen(id) && !!(b && b.querySelector('.responses-wrapper')); };
var generateId = function () { return V.param('/v1/documents/{id}/generate', 'post'); };
var notes = function () { return V.text('#operations-Documents-createDocument .emit-notes') || ''; };

V.open('Documents', 'createDocument', 2500);
V.until(function () { return bodyReady('operations-Documents-createDocument'); }, function () {
  own('/v1/documents/{id}', 'get', 'typed-by-hand');
  created('d-1');
  V.until(function () { return generateId() === 'd-1' && /Kept your own id/.test(notes()); }, first);
}, 20000);

function first() {
  check('carried into generate', generateId() === 'd-1', generateId());
  check('carried into download', V.param('/v1/documents/{id}/pdf', 'get') === 'd-1', V.param('/v1/documents/{id}/pdf', 'get'));
  check('a typed value is kept', V.param('/v1/documents/{id}', 'get') === 'typed-by-hand', V.param('/v1/documents/{id}', 'get'));
  check('the note says what was kept', /Kept your own id in Get document by ID/.test(notes()), notes());
  created('d-2');
  V.until(function () { return generateId() === 'd-2'; }, second);
}

function second() {
  check('a newer id replaces the page\'s own', generateId() === 'd-2', generateId());
  check('and still not the typed one', V.param('/v1/documents/{id}', 'get') === 'typed-by-hand');
  var link = Array.prototype.filter.call(document.querySelectorAll('#operations-Documents-createDocument .emit-note__link'),
    function (a) { return a.textContent === 'Request PDF generation'; })[0];
  check('operation names are links', !!link);
  if (link) link.click();
  V.until(function () { return isOpen('operations-Documents-requestDocumentGeneration'); }, function () {
    check('the link opens that operation', isOpen('operations-Documents-requestDocumentGeneration'));
    done();
  });
}
