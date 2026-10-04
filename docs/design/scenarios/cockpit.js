// @widths 1280
// The cockpit shell: the page itself never scrolls, the content pane does;
// the rail's map lists every operation the spec has; choosing one opens it,
// and both the map and the titlebar then say that is where the reader is.
const pane = function () { return document.querySelector('#emit-window .swagger-container > .swagger-ui'); };
const link = function (id) { return document.querySelector('.emit-map__item[data-target="operations-Documents-' + id + '"]'); };

V.until(function () { return !!link('requestDocumentGeneration') && !!pane() && !!document.querySelector('.opblock'); }, function () {
  const root = document.scrollingElement;
  check('the page does not scroll', root.scrollHeight <= innerHeight + 1, { page: root.scrollHeight, viewport: innerHeight });
  check('the content pane does', pane().scrollHeight > pane().clientHeight, { content: pane().scrollHeight, pane: pane().clientHeight });
  /* The scene sits behind the page at z-index -1: a background on any box
     between it and the window paints over the light. */
  const painted = [];
  for (let n = document.getElementById('emit-window').parentElement; n !== document.documentElement; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none') painted.push(n.tagName + '#' + n.id);
  }
  check('nothing paints over the light behind the window', !painted.length && !!document.querySelector('.emit-scene__glow'), painted);

  let operations = 0;
  Object.keys(window.ui.specSelectors.specJson().toJS().paths).forEach(function (path) {
    operations += Object.keys(window.ui.specSelectors.specJson().toJS().paths[path]).length;
  });
  const items = document.querySelectorAll('.emit-map__item[data-target^="operations-"]').length;
  check('the map lists every operation', items === operations, { map: items, spec: operations });
  check('at the top, the overview is current', !!document.querySelector('.emit-map__item--overview.is-current'));

  link('requestDocumentGeneration').click();
  V.until(function () {
    const block = document.getElementById('operations-Documents-requestDocumentGeneration');
    return block && block.classList.contains('is-open') && link('requestDocumentGeneration').classList.contains('is-current');
  }, function () {
    check('choosing it opens the operation', document.getElementById('operations-Documents-requestDocumentGeneration').classList.contains('is-open'));
    check('the map marks it current', link('requestDocumentGeneration').classList.contains('is-current'));
    const block = document.getElementById('operations-Documents-requestDocumentGeneration');
    L('landing', { scrollTop: Math.round(pane().scrollTop), paneTop: Math.round(pane().getBoundingClientRect().top),
      blockTop: Math.round(block.getBoundingClientRect().top), maxScroll: pane().scrollHeight - pane().clientHeight });
    const crumb = document.getElementById('emit-crumb').textContent;
    check('the titlebar names it', /POST \/v1\/documents\/\{id\}\/generate/.test(crumb), crumb);
    shortcuts();
  }, 15000);
}, 20000);

// Ctrl+K finds an operation by part of its name and opens it; Ctrl+B folds
// the rail's column away and brings it back.
const press = function (key, target) {
  (target || document).dispatchEvent(new KeyboardEvent('keydown', { key: key, ctrlKey: key.length === 1, bubbles: true }));
};
function shortcuts() {
  press('k');
  const palette = document.querySelector('.emit-palette');
  check('Ctrl+K opens the palette', !!palette && !palette.hidden);
  const input = document.querySelector('.emit-palette__input');
  input.value = 'tenant by';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const first = document.querySelector('.emit-palette__item[aria-selected="true"] .emit-palette__name');
  check('typing narrows it to the match', !!first && first.textContent === 'Get tenant by ID', first && first.textContent);
  press('Enter', input);
  V.until(function () {
    const block = document.getElementById('operations-Tenants-getTenant');
    return block && block.classList.contains('is-open') && palette.hidden;
  }, function () {
    check('Enter opens it and closes the palette', palette.hidden && document.getElementById('operations-Tenants-getTenant').classList.contains('is-open'));
    const rail = document.getElementById('emit-rail');
    press('b');
    V.until(function () { return rail.getBoundingClientRect().width < 2; }, function () {
      check('Ctrl+B folds the rail', document.getElementById('emit-window').dataset.rail === 'closed' && rail.getBoundingClientRect().width < 2,
            rail.getBoundingClientRect().width);
      press('b');
      V.until(function () { return rail.getBoundingClientRect().width > 200; }, function () {
        check('and brings it back', rail.getBoundingClientRect().width > 200, rail.getBoundingClientRect().width);
        done();
      }, 3000);
    }, 3000);
  }, 10000);
}
