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
  check('schema annotations: inline enum, array item type, formats',
        text('.emit-enum') === 'PENDING | PROCESSING | DONE | FAILED'
        && all('.emit-array').some(function (n) { return /array<DocumentSummaryResponse>/.test(n.textContent); })
        && all('.emit-format').some(function (n) { return n.textContent === 'uuid'; }),
        [text('.emit-enum'), all('.emit-format').length]);
  var links = all('.info .emit-step-link');
  check('three getting-started steps link to their operation', links.length === 3, links.map(function (a) { return a.textContent; }));
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
    V.until(function () { return q('#emit-legend-panel').dataset.open === 'true'; }, legend, 5000);
  });
}

function legend() {
  check('the legend opens from its button',
        q('#emit-legend-panel').dataset.open === 'true' && q('#emit-legend-btn').getAttribute('aria-expanded') === 'true');
  q('#emit-legend-btn').click();
  ui.authActions.showDefinitions(ui.authSelectors.definitionsToAuthorize());
  V.until(function () { return all('.dialog-ux .emit-scope').length === 2; }, dialog, 8000);
}

function dialog() {
  check('the Authorize dialog badges each scheme', all('.dialog-ux .emit-scope').length === 2,
        all('.dialog-ux .emit-scope').length);
  ui.authActions.showDefinitions(false);
  V.authorize('bearerAuth', V.jwt(4));
  V.until(function () { return q('#emit-topbar-auth').dataset.state === 'ADMIN'; }, function () {
    V.until(function () { return q('#emit-topbar-auth').dataset.state === 'EXPIRED'; }, function () {
      check('a token that expires while the page is open is flagged on time',
            q('#emit-topbar-auth').dataset.state === 'EXPIRED', q('#emit-topbar-auth').dataset.state);
      done();
    }, 9000);
  }, 5000);
}
