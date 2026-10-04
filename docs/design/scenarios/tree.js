// @widths 1280
// A JSON answer reads as a tree: objects and lists fold, a folded one says
// how many keys or items it holds, levels from the third start folded, and
// Alt+click folds or opens a node with all it contains. Open, the tree is
// still the answer's JSON, word for word.
const answer = {
  content: [
    { id: 'a1', title: 'Q3 Invoice', meta: { tags: ['finance', 'q3'], pages: 2 } },
    { id: 'b2', title: 'Q4 Invoice', meta: { tags: ['finance'], pages: 1 } }
  ],
  page: { size: 20, number: 0, totalElements: 2 }
};
const q = function (selector) { return document.querySelector('#operations-Documents-listDocuments ' + selector); };
const nodes = function () { return document.querySelectorAll('#operations-Documents-listDocuments .emit-json__node'); };
const folded = function () { return document.querySelectorAll('#operations-Documents-listDocuments .emit-json__node.is-folded'); };

/* Opened once the window has arrived, as a reader can. A body alone is not
   enough: an operation Swagger is still resolving has one, but no responses
   yet to draw an answer into. */
V.until(function () { return !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  V.open('Documents', 'listDocuments', 0);
  V.until(function () { return !!q('.responses-wrapper'); }, answered, 15000);
}, 20000);

function answered() {
  V.fakeResponse('/v1/documents', 'get', 200, answer, location.origin + '/v1/documents', {}, 42);
  /* The sheet can repaint as the answer settles: wait for a whole tree,
     its nodes and their folds, not for the first of them. */
  V.until(function () { return nodes().length === 9 && folded().length > 0; }, function () {
    const meta = folded();
    check('levels from the third start folded, saying what they hold',
          meta.length === 4 && /2 keys \}/.test(meta[0].querySelector('.emit-json__summary').textContent), meta.length);
    const first = meta[0];
    first.querySelector('.emit-json__toggle').click();
    check('a folded node opens on its control, what it holds keeping its own fold',
          !first.classList.contains('is-folded') && folded().length === 3 && first.querySelector('.emit-json__node').classList.contains('is-folded'));
    const root = nodes()[0];
    root.querySelector('.emit-json__toggle').dispatchEvent(new MouseEvent('click', { altKey: true, bubbles: true }));
    check('Alt+click folds a node with all it contains', folded().length === nodes().length, { folded: folded().length, all: nodes().length });
    root.querySelector('.emit-json__toggle').dispatchEvent(new MouseEvent('click', { altKey: true, bubbles: true }));
    const text = q('.emit-result .emit-json').textContent;
    let same = false;
    try { same = JSON.stringify(JSON.parse(text)) === JSON.stringify(answer); } catch { same = false; }
    check('open, the tree is still the JSON of the answer, word for word', same && folded().length === 0, text.slice(0, 80));
    done();
  }, 8000);
}
