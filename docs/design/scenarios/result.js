// @widths 1280
// A request body is edited with numbered lines, its validity said as it is
// typed, Format and the schema one tab away. After Execute one sheet says how
// the call went and holds what came back, the request shows as it was sent,
// and Edit brings the editor back.
var LOGIN = '#operations-Authentication-login ';
var TENANT = '#operations-Tenants-createTenant ';
var q = function (selector) { return document.querySelector(selector); };
var seen = function (node) { return !!node && node.getClientRects().length > 0; };
var text = function (selector) { var n = q(selector); return n ? n.textContent : ''; };

V.until(function () { return !!V.definition('bearerAuth'); }, function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.open('Tenants', 'createTenant', 0);
  V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 1500);
}, 20000);

V.until(function () { return !!q(TENANT + '.emit-validity') && !!q(LOGIN + '.emit-result'); }, function () {
  var area = q(TENANT + 'textarea.body-param__text');
  var gutter = q(TENANT + '.emit-gutter');
  check('the editor numbers its lines', gutter.textContent.split('\n').length === area.value.split('\n').length,
        { gutter: gutter.textContent.split('\n').length, lines: area.value.split('\n').length });
  check('an example that fits the schema says so', /matches CreateTenantRequest/.test(text(TENANT + '.emit-validity')), text(TENANT + '.emit-validity'));
  check('no empty parameters block', !seen(q(TENANT + '.parameters-container')));

  var setValue = function (value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, value);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setValue('{"name": "Acme"');
  V.until(function () { return /Not valid JSON/.test(text(TENANT + '.emit-validity')); }, function () {
    check('broken JSON is said as it is typed', q(TENANT + '.emit-validity').classList.contains('is-bad'), text(TENANT + '.emit-validity'));
    setValue('{"name":"Acme","schemaName":"acme"}');
    Array.prototype.filter.call(document.querySelectorAll(TENANT + '.emit-tool'), function (b) { return /Format/.test(b.textContent); })[0].click();
    V.until(function () { return area.value.split('\n').length === 4; }, function () {
      check('Format lays the body out on lines', area.value.split('\n').length === 4, area.value);
      q(TENANT + '.emit-body-tools [data-tab="schema"]').click();
      check('the schema tab lists the fields, required marked', seen(q(TENANT + '.emit-body-schema')) &&
            /schemaName\*/.test(text(TENANT + '.emit-body-schema')) && !seen(area), text(TENANT + '.emit-body-schema').slice(0, 60));

      check('the result says how it went', /^200 OK$/.test(text(LOGIN + '.emit-result__status')), text(LOGIN + '.emit-result__status'));
      check('with its time and size', /\d+ ms/.test(text(LOGIN + '.emit-result__meta')) && /\d+ B/.test(text(LOGIN + '.emit-result__meta')));
      var body = q(LOGIN + '.emit-result__panel:not([hidden]) .emit-well');
      check('the body is shown, keys told apart', !!body && body.querySelector('.k') && body.querySelector('.k').textContent === '"token"');
      q(LOGIN + '.emit-result [data-tab="headers"]').click();
      var keys = document.querySelectorAll(LOGIN + '.emit-kv__key');
      check('the headers lead with the request id', keys.length > 3 && keys[0].textContent === 'x-request-id' && keys[0].classList.contains('is-hot'),
            keys.length && keys[0].textContent);
      check('and the tab counts them', text(LOGIN + '.emit-result [data-tab="headers"] small') === String(keys.length));
      q(LOGIN + '.emit-result [data-tab="curl"]').click();
      check('curl is one tab away', /^curl /.test(text(LOGIN + '.emit-result__panel:not([hidden]) .emit-well')));

      check('the request shows as it was sent', seen(q(LOGIN + '.emit-sent')) && /"username": "admin"/.test(text(LOGIN + '.emit-sent')));
      check('without the editor or Execute', !seen(q(LOGIN + 'textarea')) && !seen(q(LOGIN + 'button.execute')));
      q(LOGIN + '.emit-tool--edit').click();
      V.until(function () { return seen(q(LOGIN + 'textarea')); }, function () {
        check('Edit brings the editor and Execute back', seen(q(LOGIN + 'textarea')) && seen(q(LOGIN + 'button.execute')));
        done();
      }, 3000);
    }, 3000);
  }, 3000);
}, 20000);
