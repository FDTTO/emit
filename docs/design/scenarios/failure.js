// @widths 1280,320
// When the API description does not load, the page says what failed, where
// and what to try, and each part drawn from the description says why it is
// empty instead of showing what it had. The failed fetch is the point, so its
// console noise is expected.
allowErrors(/api-docs-does-not-exist|Failed to load|401/);
window.scenarioConfig = { url: '/v3/api-docs-does-not-exist' };

const q = function (selector) { return document.querySelector(selector); };
const seen = function (node) { return !!node && node.getClientRects().length > 0; };

V.until(function () { return !!q('#emit-failure b') && /\d/.test(q('#emit-failure b').textContent); }, function () {
  const root = document.documentElement, width = root.clientWidth;
  const card = q('#emit-failure').getBoundingClientRect();
  check('the failure says what failed and where', /^\d{3}$/.test(q('#emit-failure b').textContent)
        && /GET \/v3\/api-docs-does-not-exist/.test(q('.emit-failure__call').textContent), q('.emit-failure__call').textContent);
  check('it offers a retry and the raw description', !!q('#emit-failure .emit-primary')
        && /api-docs-does-not-exist$/.test(q('#emit-failure a.emit-quiet').getAttribute('href')));
  check('Swagger’s own error box is not shown', !seen(q('.errors-wrapper')));
  check('no sideways scroll', root.scrollWidth <= width, { scrollWidth: root.scrollWidth, width: width });
  check('the card fits the width', card.left >= 0 && card.right <= width, { left: card.left, right: card.right, width: width });
  if (width > 900) {
    check('the rail says why it is empty', seen(q('.emit-rail__empty')) && !q('.emit-map__item') && !seen(q('#emit-journey')));
    check('the titlebar says there is no description', q('#emit-crumb').textContent === 'No API description', q('#emit-crumb').textContent);
    check('the server light turns to failure', getComputedStyle(q('.emit-status__led')).backgroundColor === 'rgb(255, 143, 132)');
  }
  done();
}, 10000);
