// @widths 1280
// Documented responses read as an index: the success line opens on its
// example, every other line is one row until chosen, the refusals every
// guarded route shares are gathered into one row listing each cause, and the
// headers most responses carry are said once with their meaning at hand.
const OP = '#operations-Documents-getDocument ';
const q = function (selector) { return document.querySelector(OP + selector); };
const seen = function (node) { if (!node) return false; const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const row = function (code) { return q('table.responses-table:not(.live-responses-table) tr.response[data-code="' + code + '"]'); };

V.open('Documents', 'getDocument', 2500);
V.until(function () { return !!q('.emit-refusals') && !!q('.emit-headers-once'); }, function () {
  const spec = window.ui.specSelectors.specJson().toJS().paths['/v1/documents/{id}'].get.responses;

  check('the success line opens on its example', seen(row('200').querySelector('.emit-example')));
  check('another line is one row until chosen', !seen(row('404').querySelector('.model-example')));

  let shared = 0;
  Object.keys(spec).forEach(function (code) {
    const media = spec[code].content && spec[code].content['application/json'];
    const examples = (media && media.examples) || {};
    Object.keys(examples).forEach(function (name) {
      if (['missing-credential', 'invalid-api-key', 'wrong-credential', 'tenant-inactive', 'rate-limited', 'invalid-id'].indexOf(name) !== -1) shared++;
    });
  });
  const listed = document.querySelectorAll(OP + '.emit-refusals__table tr').length;
  check('the shared refusals are one row with every cause', listed === shared && listed > 0, { listed: listed, spec: shared });
  check('their own rows are gone', !seen(row('401')) && !seen(row('429')));

  const chips = Array.prototype.map.call(document.querySelectorAll(OP + '.emit-headers-once code'), function (c) { return c.textContent; });
  check('the budget headers are said once', ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'].every(function (n) {
    return chips.indexOf(n) !== -1;
  }) && seen(q('.emit-headers-once')), chips);
  const retry = q('.emit-refusals__table tr[data-code="429"] code');
  check('a header only the refusal adds goes on its line', !!retry && retry.textContent === 'Retry-After' && chips.indexOf('Retry-After') === -1,
    retry && retry.textContent);
  const said = Array.prototype.slice.call(document.querySelectorAll(OP + '.emit-headers-once code')).concat(retry ? [retry] : []);
  check('each keeps its meaning at hand', said.length >= 4 && said.every(function (c) {
    return c.title.length > 10;
  }), said.length + ' headers');
  check('no per-response headers table is shown', !seen(q('table.responses-table:not(.live-responses-table) .headers-wrapper')));

  q('.emit-refusals__head').click();
  const group = q('.emit-refusals').getBoundingClientRect(), causes = q('.emit-refusals__table').getBoundingClientRect();
  check('the causes stay inside their row, long ones wrapping', causes.width > 0 && causes.right <= group.right - 11,
        { causes: causes.right, row: group.right });
  q('.emit-refusals__head').click();

  row('404').querySelector('.response-col_description__inner').click();
  V.until(function () { return seen(row('404').querySelector('.emit-example')); }, function () {
    check('choosing a line opens it', seen(row('404').querySelector('.emit-example')));
    done();
  }, 5000);
}, 20000);
