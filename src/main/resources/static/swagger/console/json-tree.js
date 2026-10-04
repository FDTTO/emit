/*
 * A JSON answer as a tree that folds.
 */
import { el, plural } from './dom.js';

/* A JSON answer as a tree: every object and list folds, and a folded one
   says how many keys or items it holds; Alt+click folds or opens one with
   everything inside it. Levels from the third start folded, so a long
   answer reads as its outline first. Built as nodes, like the colours. */
const FOLD_FROM_DEPTH = 3;

export function renderJsonTree(target, value) {
  target.classList.add('emit-json');
  target.textContent = '';
  target.appendChild(jsonNode(value, null, 0, true));
}

function jsonNode(value, key, depth, last) {
  const comma = last ? '' : ',';
  const head = el('div', 'emit-json__line');
  if (key !== null) {
    head.appendChild(el('span', 'k', JSON.stringify(key)));
    head.appendChild(document.createTextNode(': '));
  }
  if (value === null || typeof value !== 'object') {
    head.appendChild(el('span', typeof value === 'string' ? 's' : 'n', JSON.stringify(value)));
    head.appendChild(document.createTextNode(comma));
    return head;
  }
  const list = Array.isArray(value);
  const keys = list ? Array.from(value.keys()) : Object.keys(value);
  const close = (list ? ']' : '}') + comma;
  if (!keys.length) {
    head.appendChild(document.createTextNode((list ? '[' : '{') + close));
    return head;
  }
  const node = el('div', 'emit-json__node');
  const toggle = el('button', 'emit-json__toggle');
  toggle.type = 'button';
  head.insertBefore(toggle, head.firstChild);
  head.appendChild(document.createTextNode(list ? '[' : '{'));
  const kids = el('div', 'emit-json__kids');
  keys.forEach(function (at, index) {
    kids.appendChild(jsonNode(value[at], list ? null : at, depth + 1, index === keys.length - 1));
  });
  node.appendChild(head);
  node.appendChild(kids);
  node.appendChild(el('div', 'emit-json__line emit-json__close', close));
  node.dataset.close = close;
  node.dataset.count = plural(keys.length, list ? 'item' : 'key');
  toggle.addEventListener('click', function (event) {
    const folded = !node.classList.contains('is-folded');
    foldJson(node, folded);
    if (event.altKey)
      node.querySelectorAll('.emit-json__node').forEach(function (inner) {
        foldJson(inner, folded);
      });
  });
  foldJson(node, depth >= FOLD_FROM_DEPTH);
  return node;
}

function foldJson(node, folded) {
  node.classList.toggle('is-folded', folded);
  const head = node.firstChild;
  const toggle = head.firstChild;
  toggle.setAttribute('aria-expanded', String(!folded));
  toggle.setAttribute('aria-label', folded ? 'Open ' + node.dataset.count : 'Fold');
  let summary = head.querySelector(':scope > .emit-json__summary');
  if (folded && !summary) {
    summary = el('span', 'emit-json__summary');
    summary.appendChild(el('small', null, ' ' + node.dataset.count + ' '));
    summary.appendChild(document.createTextNode(node.dataset.close));
    head.appendChild(summary);
  } else if (!folded && summary) {
    summary.remove();
  }
}
