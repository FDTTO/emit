/*
 * Element and icon builders the modules draw with.
 */
import { config } from './state.js';

/* 24 grid, 1.8 stroke, no fills. */
const PATHS = {
  list:     ['M4 6h16M4 12h16M4 18h10'],
  doc:      ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  docPlus:  ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M12 11v6M9 14h6'],
  bolt:     ['M13 2L4 14h7l-1 8 9-12h-7z'],
  download: ['M12 3v12M7 11l5 5 5-5', 'M4 20h16'],
  key:      ['M14 7a4 4 0 1 0-3.5 4L12 12.5V15h2v2h2v2h3v-3.5L14 11z'],
  powerOff: ['M12 4v8', 'M7.5 7a7 7 0 1 0 9 0'],
  restore:  ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  trash:    ['M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13'],
  building: ['M4 21V6l7-3 7 3v15', 'M9 21v-5h6v5', 'M8 10h2M14 10h2'],
  buildingPlus: ['M3 21V7l6-3 6 3v14', 'M7 21v-4h4v4', 'M6 11h2M12 11h2', 'M16 6h6M19 3v6'],
  /* Scope marks: a shield for a token, a key for an API key. */
  shield: ['M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z'],
  apiKey: ['M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 12h9M18 12v4'],
  /* Topbar credential tag: open when empty, closed when holding a credential. */
  lockClosed: ['M5 11h14v9H5z', 'M9 11V7a3 3 0 0 1 6 0v4'],
  /* Marks a getting-started step that leads to the operation it names. */
  goTo: ['M7 17L17 7', 'M8 7h9v9'],
  /* Rail: the overview entry and the collapse control. */
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  search: ['M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M20 20l-4.5-4.5'],
  copy: ['M8 8h11v11H8z', 'M5 16V5h11'],
  format: ['M4 6h10M4 12h16M4 18h12'],
  reset: ['M4 12a8 8 0 1 0 2.34-5.66', 'M4 4v5h5'],
  pencil: ['M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  close: ['M6 6l12 12M18 6L6 18'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  alert: ['M12 8v5', 'M12 16.5v.5', 'M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  braces: ['M8 4c-2 0-2 2-2 4s-2 4-2 4 2 2 2 4 0 4 2 4', 'M16 4c2 0 2 2 2 4s2 4 2 4-2 2-2 4 0 4-2 4'],
  unfold: ['M8 9l4-4 4 4', 'M8 15l4 4 4-4'],
  play: ['M7 5l12 7-12 7z'],
  history: ['M4 12a8 8 0 1 0 2.34-5.66', 'M4 4v5h5', 'M12 8v4l3 2'],
  stop: ['M7 7h10v10H7z'],
  comfortable: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  compact: ['M4 5h16', 'M4 9.7h16', 'M4 14.3h16', 'M4 19h16'],
  fold: ['M8 5l4 4 4-4', 'M8 19l4-4 4 4']
};

const ICON_BY_METHOD = {
  get: 'doc', post: 'docPlus', put: 'pencil', patch: 'pencil', delete: 'trash'
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name) {
  const d = PATHS[name];
  if (!d) return null;
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.8');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < d.length; i++) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d[i]);
    el.appendChild(p);
  }
  return el;
}

export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export function iconFor(method, path) {
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';

  // What the call does beats what it addresses.
  if (config.actionIcons[last]) return config.actionIcons[last];

  // Otherwise: which resource, and is this the collection or one item.
  const isItem = last.indexOf('{') !== -1;
  const resource = config.resourceIcons[isItem ? segments[segments.length - 2] : last];
  if (resource) {
    if (method === 'get') return isItem ? resource.item : resource.list;
    if (method === 'post' && !isItem) return resource.create;
    return resource.item;
  }

  // Unknown resource: the verb is the only honest signal left.
  if (method === 'get' && !isItem) return 'list';
  return ICON_BY_METHOD[method] || 'doc';
}

export function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}
