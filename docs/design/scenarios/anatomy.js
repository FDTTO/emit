// @widths 1280
// @wait 60000
// What the console paints on top of stock Swagger, read from the page: each
// operation's icon and credential badge, the split title, the status band of
// each response row, the endpoint counts, the getting-started links, the
// lifecycle figure's place, the legend, the schema annotations, the badges in
// the Authorize dialog, and a token that expires while the page is open.
var q = function (selector) { return document.querySelector(selector); };
var all = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
var text = function (selector) { var n = q(selector); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; };
var isOpen = function (id) { var b = document.getElementById(id); return !!b && b.classList.contains('is-open'); };
var scopeOf = function (id) {
  var badge = q('#' + id + ' .opblock-summary .emit-scope');
  return badge ? badge.className.replace(/.*emit-scope--(\w+).*/, '$1') : null;
};

V.until(function () { return all('.opblock .emit-op-icon svg path').length === all('.opblock').length && !!q('.emit-count'); }, function () {
  var blocks = all('.opblock');
  check('every operation has an icon', blocks.every(function (b) { return !!b.querySelector('.emit-op-icon svg path'); }),
        blocks.length + ' operations');
  check('each operation names the credential it takes',
        scopeOf('operations-Authentication-login') === 'public' && scopeOf('operations-Tenants-createTenant') === 'admin'
        && scopeOf('operations-Documents-getDocument') === 'tenant',
        [scopeOf('operations-Authentication-login'), scopeOf('operations-Tenants-createTenant'), scopeOf('operations-Documents-getDocument')]);
  check('the title is split into mark and kind', text('.emit-title-mark') === 'EMIT' && text('.emit-title-kind') === 'API',
        [text('.emit-title-mark'), text('.emit-title-kind')]);
  check('group headers count their endpoints, singular included',
        text('h3.opblock-tag[data-tag="Documents"] .emit-count') === '5 endpoints'
        && text('h3.opblock-tag[data-tag="Authentication"] .emit-count') === '1 endpoint',
        [text('h3.opblock-tag[data-tag="Documents"] .emit-count'), text('h3.opblock-tag[data-tag="Authentication"] .emit-count')]);
  var figure = q('#emit-lifecycle');
  check('the lifecycle figure sits between the lede and Authentication',
        !!figure && figure.previousElementSibling.tagName === 'P' && figure.nextElementSibling.tagName === 'H2'
        && /Authentication/.test(figure.nextElementSibling.textContent),
        figure && [figure.previousElementSibling.tagName, figure.nextElementSibling.textContent]);
  var fields = '#emit-schemas ';
  check('schema fields: enum values, array item type, formats',
        all(fields + '.emit-constraint').some(function (n) { return n.textContent === 'PENDING | PROCESSING | DONE | FAILED'; })
        && all(fields + '.emit-chip--type').some(function (n) { return n.textContent === 'DocumentSummaryResponse[]'; })
        && all(fields + '.emit-chip--format').some(function (n) { return n.textContent === 'uuid'; }),
        [all(fields + '.emit-constraint').length, all(fields + '.emit-chip--format').length]);
  var links = all('.info .emit-step-link');
  var steps = all('.info ol > li');
  check('every getting-started step links to its operation', steps.length > 0 && links.length === steps.length,
        { steps: steps.length, links: links.map(function (a) { return a.textContent; }) });
  var tenants = links.filter(function (a) { return a.textContent === 'POST /v1/tenants'; })[0];
  if (tenants) tenants.click();
  V.until(function () { return isOpen('operations-Tenants-createTenant'); }, rows, 15000);
}, 20000);

function rows() {
  check('a step link opens its operation', isOpen('operations-Tenants-createTenant'));
  V.open('Documents', 'getDocument', 0);
  V.until(function () {
    var found = all('#operations-Documents-getDocument tr.response');
    return found.length === 5 && found.every(function (r) { return /resp-s/.test(r.className); });
  }, function () {
    var band = function (code) { var r = q('#operations-Documents-getDocument tr.response[data-code="' + code + '"]'); return r && r.className; };
    check('response rows carry their status band',
          /resp-s2/.test(band(200)) && /resp-s4/.test(band(404)) && /resp-s5/.test(band(429)),
          [band(200), band(404), band(429)]);
    q('#emit-legend-btn').click();
    V.until(function () { return !q('#emit-legend-panel').hidden; }, legend, 5000);
  });
}

function legend() {
  check('the legend opens from its button',
        !q('#emit-legend-panel').hidden && q('#emit-legend-btn').getAttribute('aria-expanded') === 'true');
  var outcomes = all('#emit-legend-panel .emit-legend__outcome').map(function (n) { return n.textContent; });
  check('the legend reads outcomes, callers, fields and keys, amber as wait then retry',
        all('#emit-legend-panel section').length === 4 && outcomes.join(',') === '2xx,4xx,429,RUN'
        && /wait, then retry/.test(q('#emit-legend-panel').textContent), outcomes);
  q('#emit-legend-panel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape closes it', q('#emit-legend-panel').hidden && q('#emit-legend-btn').getAttribute('aria-expanded') === 'false');
  q('#emit-topbar-auth').click();
  V.until(function () { return all('#emit-auth:not([hidden]) .emit-scope').length === 2; }, dialog, 8000);
}

function dialog() {
  check('the credentials dialog badges each scheme', all('#emit-auth .emit-scope').length === 2,
        all('#emit-auth .emit-scope').length);
  q('#emit-auth .emit-auth__close').click();
  V.authorize('bearerAuth', V.jwt(4));
  V.until(function () { return q('#emit-topbar-auth').dataset.state === 'ADMIN'; }, function () {
    V.until(function () { return q('#emit-topbar-auth').dataset.state === 'EXPIRED'; }, function () {
      check('a token that expires while the page is open is flagged on time',
            q('#emit-topbar-auth').dataset.state === 'EXPIRED', q('#emit-topbar-auth').dataset.state);
      done();
    }, 9000);
  }, 5000);
}
