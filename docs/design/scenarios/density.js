// @widths 1280
// Density is the reader's choice from the statusbar, remembered, and it
// changes the page's measures in whole pixels: a compact titlebar and
// rows, the same reading text.
var root = document.documentElement;
var bar = function () { return document.querySelector('.swagger-container > .topbar').getBoundingClientRect().height; };
var row = function () { return document.querySelector('.opblock .opblock-summary').getBoundingClientRect().height; };
var text = function () { return getComputedStyle(document.querySelector('.opblock .opblock-summary-description')).fontSize; };

try { localStorage.removeItem('emit.density'); } catch (ignored) { /* private mode */ }
V.until(function () { return !!document.getElementById('emit-density') && !!document.querySelector('.opblock .opblock-summary-description'); }, function () {
  check('a tall screen starts comfortable', root.dataset.density === 'comfortable', root.dataset.density);
  var comfortable = { bar: bar(), row: row(), text: text() };
  document.getElementById('emit-density').click();
  var compact = { bar: bar(), row: row(), text: text() };
  check('choosing compact tightens the chrome and the rows in whole pixels',
        root.dataset.density === 'compact' && compact.bar === 40 && compact.row < comfortable.row && compact.row % 1 === 0,
        { comfortable: comfortable, compact: compact });
  check('and keeps the reading text', compact.text === comfortable.text, compact.text);
  var stored = null;
  try { stored = localStorage.getItem('emit.density'); } catch (ignored) { /* private mode */ }
  check('the choice is remembered', stored === 'compact', stored);
  document.getElementById('emit-density').click();
  check('and can be taken back', root.dataset.density === 'comfortable' && bar() === comfortable.bar);
  try { localStorage.removeItem('emit.density'); } catch (ignored) { /* private mode */ }
  done();
}, 15000);
