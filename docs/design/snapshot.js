// A page in a known state, for a pixel comparison before and after a change.
// Nothing here executes a request. What the page still generates per load,
// the timestamps inside schema examples, is reported for pixdiff to mask.
V.open('Documents', 'getDocument', 2500);
V.open('Tenants', 'createTenant', 4000);
setTimeout(function () {
  var models = document.querySelector('.models-control');
  if (models && models.getAttribute('aria-expanded') !== 'true') models.click();
}, 5600);
setTimeout(function () {
  var boxes = [];
  document.querySelectorAll('.microlight, .model-example, .json-schema-2020-12-json-viewer').forEach(function (node) {
    var r = node.getBoundingClientRect();
    if (r.width && r.height) boxes.push({ x: r.x, y: r.y + scrollY, width: r.width, height: r.height });
  });
  L('dynamic', boxes);
  done();
}, 7600);
