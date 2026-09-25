// @widths 1280
// The models read like operations: a row each until chosen, the fields as
// rows once open, the operations that use a model as links to them, and a
// field of another model's type as a way to that model. The map reaches the
// section and says when the reader is in it.
var row = function (name) { return document.getElementById('emit-model-' + name); };
var seen = function (node) { return !!node && node.getClientRects().length > 0; };
var entry = function () { return document.querySelector('.emit-map__item[data-target="emit-schemas"]'); };

V.until(function () { return !!row('PageResponseDocumentSummaryResponse') && !!entry(); }, function () {
  var models = Object.keys(window.ui.specSelectors.specJson().toJS().components.schemas).length;
  check('every model is a row', document.querySelectorAll('#emit-schemas .emit-model').length === models, models);
  check('the map has a Schemas entry that counts them', entry().textContent.indexOf(String(models)) !== -1, entry().textContent);
  check('a row is closed until chosen', !seen(row('CreateTenantRequest').querySelector('.emit-field')));

  row('CreateTenantRequest').querySelector('.emit-model__head').click();
  var names = Array.prototype.map.call(row('CreateTenantRequest').querySelectorAll('.emit-field__name'), function (n) { return n.textContent; });
  check('open, it lists its fields, required marked', names.join(',') === 'name*,schemaName*', names);
  check('with the rules the API applies', /1 to 100 characters/.test(row('CreateTenantRequest').textContent));
  var users = Array.prototype.map.call(row('CreateTenantRequest').querySelectorAll('.emit-model__user'), function (n) { return n.textContent; });
  check('and the operations that use it', users.join(',') === 'POST /v1/tenants', users);

  row('PageResponseDocumentSummaryResponse').querySelector('.emit-model__head').click();
  var link = Array.prototype.filter.call(row('PageResponseDocumentSummaryResponse').querySelectorAll('button.emit-chip'), function (b) {
    return b.textContent === 'DocumentSummaryResponse[]';
  })[0];
  check('a field of another model\'s type is a way to it', !!link);
  if (link) link.click();
  V.until(function () { return row('DocumentSummaryResponse').classList.contains('is-open'); }, function () {
    check('which opens that model', row('DocumentSummaryResponse').classList.contains('is-open'));
    entry().click();
    V.until(function () { return entry().classList.contains('is-current'); }, function () {
      check('the map brings the section into view and marks it current', entry().classList.contains('is-current'));
      check('and the titlebar says so', document.getElementById('emit-crumb').textContent === 'Schemas', document.getElementById('emit-crumb').textContent);
      done();
    }, 5000);
  }, 3000);
}, 20000);
