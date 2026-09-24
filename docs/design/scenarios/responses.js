// @widths 1280
// Documented responses read as an index: the success line opens on its
// example, every other line is one row until chosen, the refusals every
// guarded route shares are gathered into one row listing each cause, and the
// headers most responses carry are said once with their meaning at hand.
var OP = '#operations-Documents-getDocument ';
var q = function (selector) { return document.querySelector(OP + selector); };
var seen = function (node) { if (!node) return false; var r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
var row = function (code) { return q('table.responses-table:not(.live-responses-table) tr.response[data-code="' + code + '"]'); };

V.open('Documents', 'getDocument', 2500);
V.until(function () { return !!q('.emit-refusals') && !!q('.emit-headers-once'); }, function () {
  var spec = window.ui.specSelectors.specJson().toJS().paths['/v1/documents/{id}'].get.responses;

  check('the success line opens on its example', seen(row('200').querySelector('.model-example')));
  check('another line is one row until chosen', !seen(row('404').querySelector('.model-example')));

  var shared = 0;
  Object.keys(spec).forEach(function (code) {
    var media = spec[code].content && spec[code].content['application/json'];
    var examples = (media && media.examples) || {};
    Object.keys(examples).forEach(function (name) {
      if (['missing-credential', 'invalid-api-key', 'wrong-credential', 'tenant-inactive', 'rate-limited', 'invalid-id'].indexOf(name) !== -1) shared++;
    });
  });
  var listed = document.querySelectorAll(OP + '.emit-refusals__table tr').length;
  check('the shared refusals are one row with every cause', listed === shared && listed > 0, { listed: listed, spec: shared });
  check('their own rows are gone', !seen(row('401')) && !seen(row('429')));

  var chips = Array.prototype.map.call(document.querySelectorAll(OP + '.emit-headers-once code'), function (c) { return c.textContent; });
  check('the budget headers are said once', ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'].every(function (n) {
    return chips.indexOf(n) !== -1;
  }) && seen(q('.emit-headers-once')), chips);
  var said = document.querySelectorAll(OP + '.emit-headers-once code');
  check('each keeps its meaning at hand', said.length >= 4 && Array.prototype.every.call(said, function (c) {
    return c.title.length > 10;
  }), said.length + ' headers');
  check('no per-response headers table is shown', !seen(q('table.responses-table:not(.live-responses-table) .headers-wrapper')));

  row('404').querySelector('.response-col_description__inner').click();
  V.until(function () { return seen(row('404').querySelector('.model-example')); }, function () {
    check('choosing a line opens it', seen(row('404').querySelector('.model-example')));
    done();
  }, 5000);
}, 20000);
