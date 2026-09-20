// @widths 1280
// A created id carried into the operations that take it:
// never over a value the reader typed, replacing only its own, with the
// operation names as links. Responses are faked; nothing reaches the backend.
var created = function (id) {
  V.fakeResponse('/v1/documents', 'post', 201, { id: id, status: 'PENDING' }, 'http://localhost:8080/v1/documents');
};
var own = function (path, method, value) {
  var parameter = ui.specSelectors.specJson().getIn(['paths', path, method, 'parameters'])
    .find(function (p) { return p.get('name') === 'id'; });
  ui.specActions.changeParamByIdentity([path, method], parameter, value);
};

V.open('Documents', 'createDocument', 3500);
setTimeout(function () { own('/v1/documents/{id}', 'get', 'typed-by-hand'); created('d-1'); }, 5000);

setTimeout(function () {
  check('carried into generate', V.param('/v1/documents/{id}/generate', 'post') === 'd-1', V.param('/v1/documents/{id}/generate', 'post'));
  check('carried into download', V.param('/v1/documents/{id}/pdf', 'get') === 'd-1', V.param('/v1/documents/{id}/pdf', 'get'));
  check('a typed value is kept', V.param('/v1/documents/{id}', 'get') === 'typed-by-hand', V.param('/v1/documents/{id}', 'get'));
  check('the note says what was kept', /Kept your own id in Get document by ID/.test(V.text('#operations-Documents-createDocument .emit-notes') || ''),
        V.text('#operations-Documents-createDocument .emit-notes'));
  created('d-2');
}, 5800);

setTimeout(function () {
  check('a newer id replaces the page\'s own', V.param('/v1/documents/{id}/generate', 'post') === 'd-2', V.param('/v1/documents/{id}/generate', 'post'));
  check('and still not the typed one', V.param('/v1/documents/{id}', 'get') === 'typed-by-hand');
  var link = Array.prototype.filter.call(document.querySelectorAll('#operations-Documents-createDocument .emit-note__link'),
    function (a) { return a.textContent === 'Request PDF generation'; })[0];
  check('operation names are links', !!link);
  if (link) link.click();
}, 6600);

setTimeout(function () {
  var block = document.getElementById('operations-Documents-requestDocumentGeneration');
  check('the link opens that operation', !!block && block.classList.contains('is-open'));
  done();
}, 8000);
