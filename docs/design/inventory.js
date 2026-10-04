// An interface inventory of the console: every distinct corner radius, type
// size and weight, family and border colour the page actually renders, with
// how often each occurs and one element that uses it. A coherent system has
// few values; a rare one is usually a leftover. Opens operations, a live
// response and the schemas first, so their styles are in the count.
//
//   python tools/prumo run docs/design/inventory.js --wait 30000
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 0);
V.open('Documents', 'getDocument', 0);
V.open('Tenants', 'createTenant', 0);
const ready = function (id) {
  const op = document.getElementById('operations-' + id);
  return !!op && op.classList.contains('is-open') && !!op.querySelector('.responses-wrapper');
};
V.until(
  function () {
    return !!document.querySelector('.models-control');
  },
  function () {
    const models = document.querySelector('.models-control');
    if (models.getAttribute('aria-expanded') !== 'true') models.click();
    V.until(
      function () {
        return (
          !!document.querySelector('#operations-Authentication-login .emit-result') &&
          ready('Documents-getDocument') &&
          ready('Tenants-createTenant') &&
          document.querySelector('.models-control').getAttribute('aria-expanded') === 'true'
        );
      },
      function () {
        const found = V.inventory();
        Object.keys(found).forEach(function (kind) {
          L(kind, found[kind]);
        });
        done();
      },
      25000,
    );
  },
  15000,
);
