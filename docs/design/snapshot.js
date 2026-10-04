// A page in a known state, for a pixel comparison before and after a change.
// Nothing here executes a request. What the page still generates per load,
// the timestamps inside schema examples, is reported for pixdiff to mask.
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
          ready('Documents-getDocument') &&
          ready('Tenants-createTenant') &&
          document.querySelector('.models-control').getAttribute('aria-expanded') === 'true'
        );
      },
      function () {
        const boxes = [];
        document
          .querySelectorAll('.microlight, .model-example, .json-schema-2020-12-json-viewer')
          .forEach(function (node) {
            const r = node.getBoundingClientRect();
            if (r.width && r.height) boxes.push({ x: r.x, y: r.y + scrollY, width: r.width, height: r.height });
          });
        L('dynamic', boxes);
        done();
      },
      25000,
    );
  },
  15000,
);
