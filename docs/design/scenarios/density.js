// @widths 1280
// Density is the reader's choice from the statusbar, remembered, and it
// changes the page's measures in whole pixels: a compact titlebar and
// rows, the same reading text.
const root = document.documentElement;
const bar = function () { return document.querySelector('.swagger-container > .topbar').getBoundingClientRect().height; };
const row = function () { return document.querySelector('.opblock .opblock-summary').getBoundingClientRect().height; };
const text = function () { return getComputedStyle(document.querySelector('.opblock .opblock-summary-description')).fontSize; };
const model = function () { return document.querySelector('.emit-model__head').getBoundingClientRect().height; };

try { localStorage.removeItem('emit.density'); } catch { /* private mode */ }
V.until(function () { return !!document.getElementById('emit-density') && !!document.querySelector('.opblock .opblock-summary-description') && !!document.querySelector('.emit-model__head'); }, function () {
  check('a tall screen starts comfortable', root.dataset.density === 'comfortable', root.dataset.density);
  const comfortable = { bar: bar(), row: row(), text: text(), model: model() };
  document.getElementById('emit-density').click();
  const compact = { bar: bar(), row: row(), text: text(), model: model() };
  check('choosing compact tightens the chrome and the rows in whole pixels',
        root.dataset.density === 'compact' && compact.bar === 40 && compact.row < comfortable.row && compact.row % 1 === 0,
        { comfortable: comfortable, compact: compact });
  check('and keeps the reading text', compact.text === comfortable.text, compact.text);
  check('the schemas tighten with the operations', compact.model < comfortable.model, { comfortable: comfortable.model, compact: compact.model });
  let stored = null;
  try { stored = localStorage.getItem('emit.density'); } catch { /* private mode */ }
  check('the choice is remembered', stored === 'compact', stored);
  document.getElementById('emit-density').click();
  check('and can be taken back', root.dataset.density === 'comfortable' && bar() === comfortable.bar);
  try { localStorage.removeItem('emit.density'); } catch { /* private mode */ }
  done();
}, 15000);
