// @widths 1280
// @alone
// What answers a pointer, under a real one: Execute's light grows, a map
// entry and the rail's next step take the interaction tint, and an
// operation's row says it can be opened. Each value is read before and
// under the pointer, so a hover rule that no longer applies fails here.
// Trusted input runs alone, like the keyboard scenarios: in parallel,
// three browsers contend for the one pointer.
var steps = [
  { name: 'Execute brightens under the pointer', selector: '#operations-Documents-createDocument .btn.execute', property: 'box-shadow' },
  { name: 'a map entry takes the interaction tint', selector: '.emit-map__item[data-target="operations-Tenants-listTenants"]', property: 'background-color' },
  { name: 'the rail\'s next step lights', selector: '.emit-journey__next', property: 'background-color' },
  { name: 'a closed operation row answers the pointer', selector: '#operations-Tenants-getTenant .opblock-summary', property: 'background-color' }
];

function next(index) {
  if (index === steps.length) return done();
  var step = steps[index];
  var element = document.querySelector(step.selector);
  if (!element) {
    check(step.name, false, 'missing: ' + step.selector);
    return next(index + 1);
  }
  element.scrollIntoView({ block: 'center' });
  setTimeout(function () {
    var before = getComputedStyle(element)[step.property.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })];
    V.hover(step.selector);
    V.until(function () { return element.matches(':hover'); }, function () {
      setTimeout(function () {
        var after = getComputedStyle(element)[step.property.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })];
        var box = element.getBoundingClientRect();
        var under = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        check(step.name, element.matches(':hover') && after !== before,
              { before: before, after: after, hovered: element.matches(':hover'), under: under && String(under.className || under.tagName).slice(0, 60) });
        next(index + 1);
      }, 150);
    }, 3000);
  }, 300);
}

V.until(function () { return !!document.querySelector('.emit-journey__next') && !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  V.open('Documents', 'createDocument', 0);
  V.until(function () { return !!document.querySelector('#operations-Documents-createDocument .responses-wrapper'); }, function () {
    /* The runner asks for reduced motion, as a reader may. */
    var execute = document.querySelector('#operations-Documents-createDocument .btn.execute');
    check('with motion reduced, Execute changes without a transition',
          matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(execute).transitionDuration.split(',').every(function (d) { return parseFloat(d) === 0; }),
          getComputedStyle(execute).transitionDuration);
    next(0);
  }, 10000);
}, 20000);
