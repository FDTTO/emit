/*
 * The command palette: actions and operations, each saying what it would
 * do now.
 */
import { openCredentials } from './credentials.js';
import { el, icon, iconFor, plural } from './dom.js';
import { journeyState, runJourney, stopJourney } from './journey.js';
import { mapEntries } from './map.js';
import { allShown, openOperation, showAllOf } from './operations.js';
import { PHONE } from './phone.js';
import { toggleRail } from './shell.js';
import { operationIndex } from './spec.js';
import { config, runtime } from './state.js';
import { toggleDensity } from './statusbar.js';

/* Ctrl+K: one field for everything. Type part of an operation's name or
   path and land on it, or part of an action and run it. Actions are read
   afresh each time it opens, so each says what it would do now. */
let palette = null;

export function openPalette() {
  if (!runtime.spec) return;
  if (!palette) palette = buildPalette();
  palette.entries = paletteActions().concat(paletteOperations());
  palette.back.hidden = false;
  palette.input.value = '';
  palette.selected = 0;
  renderPalette();
  palette.input.focus();
}

function closePalette() {
  if (palette) palette.back.hidden = true;
}

function paletteOperations() {
  const entries = [];
  mapEntries().forEach(function (group) {
    group.operations.forEach(function (operation) {
      entries.push({
        group: 'Operations', name: operation.name, icon: iconFor(operation.method, operation.path),
        detail: operation.method.toUpperCase() + ' ' + operation.path,
        run: function () { openOperation({ tag: operation.tag, id: operation.id }); }
      });
    });
  });
  return entries;
}

function paletteActions() {
  const win = document.getElementById('emit-window');
  const compact = document.documentElement.dataset.density === 'compact';
  const folded = win && win.dataset.rail === 'closed';
  const actions = [];
  const login = config.credentialSources[0] && operationIndex()[config.credentialSources[0].method.toUpperCase() + ' ' + config.credentialSources[0].path];
  if (login) actions.push({ name: config.credentialSources[0].action, icon: 'lockClosed', detail: config.scopes[config.credentialSources[0].scheme].missing, run: function () { openOperation(login); } });
  actions.push({ name: 'Credentials', icon: 'shield', detail: 'Authorize', run: openCredentials });
  if (runtime.autopilot) actions.push({ name: 'Stop running the steps', icon: 'stop', detail: 'Getting started', run: stopJourney });
  else if (journeyState().next >= 0) actions.push({ name: 'Run all steps', icon: 'play', detail: 'Getting started', run: runJourney });
  actions.push({ name: compact ? 'Comfortable layout' : 'Compact layout', icon: compact ? 'comfortable' : 'compact', detail: 'density', run: toggleDensity });
  if (!PHONE.matches) actions.push({ name: folded ? 'Unfold the rail' : 'Fold the rail', icon: 'chevronLeft', detail: 'Ctrl B', run: toggleRail });
  actions.push({ name: 'Legend', icon: 'braces', detail: 'reading this page', run: function () { document.getElementById('emit-legend-btn').click(); } });
  mapEntries().forEach(function (group) {
    const open = allShown(group.tag);
    actions.push({ name: (open ? 'Close all in ' : 'Open all in ') + group.tag, icon: open ? 'fold' : 'unfold',
                   detail: plural(group.operations.length, 'operation'), run: function () { showAllOf(group.tag, !open); } });
  });
  actions.push({ name: 'Go to the overview', icon: 'home', detail: 'top', run: function () {
    const info = document.querySelector('.information-container');
    if (info) info.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } });
  if (document.getElementById('emit-schemas')) {
    actions.push({ name: 'Go to the schemas', icon: 'braces', detail: 'models', run: function () {
      document.getElementById('emit-schemas').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } });
  }
  return actions.map(function (action) { action.group = 'Actions'; return action; });
}

function buildPalette() {
  const back = el('div', 'emit-palette');
  back.hidden = true;
  const box = el('div', 'emit-palette__box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Jump to an operation or run an action');
  const input = el('input', 'emit-palette__input');
  input.placeholder = 'Jump to an operation or run an action…';
  input.setAttribute('aria-label', 'Operation or action');
  input.autocomplete = 'off';
  const list = el('ul', 'emit-palette__list');
  list.setAttribute('role', 'listbox');
  const foot = el('div', 'emit-palette__foot');
  ['↑↓ choose', 'Enter run', 'Esc close'].forEach(function (hint) { foot.appendChild(el('span', null, hint)); });
  box.appendChild(input);
  box.appendChild(list);
  box.appendChild(foot);
  back.appendChild(box);
  document.body.appendChild(back);

  const state = { back: back, input: input, list: list, entries: [], shown: [], selected: 0 };

  back.addEventListener('click', function (event) { if (event.target === back) closePalette(); });
  input.addEventListener('input', function () { state.selected = 0; renderPalette(); });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') { state.selected = Math.min(state.selected + 1, state.shown.length - 1); renderPalette(); event.preventDefault(); }
    if (event.key === 'ArrowUp') { state.selected = Math.max(state.selected - 1, 0); renderPalette(); event.preventDefault(); }
    if (event.key === 'Enter' && state.shown[state.selected]) choose(state.shown[state.selected]);
    if (event.key === 'Escape') closePalette();
  });
  list.addEventListener('click', function (event) {
    const item = event.target.closest('li[data-index]');
    if (item) choose(state.shown[Number(item.dataset.index)]);
  });
  return state;
}

function choose(entry) {
  closePalette();
  entry.run();
}

function renderPalette() {
  const query = palette.input.value.trim().toLowerCase();
  palette.shown = palette.entries.filter(function (entry) {
    return (entry.name + ' ' + entry.detail).toLowerCase().indexOf(query) !== -1;
  });
  palette.selected = Math.min(palette.selected, Math.max(0, palette.shown.length - 1));
  palette.list.textContent = '';
  let group = null;
  palette.shown.forEach(function (entry, index) {
    if (entry.group !== group) {
      group = entry.group;
      palette.list.appendChild(el('li', 'emit-palette__group', group)).setAttribute('role', 'presentation');
    }
    const item = el('li', 'emit-palette__item');
    item.dataset.index = String(index);
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === palette.selected));
    item.appendChild(icon(entry.icon));
    item.appendChild(el('span', 'emit-palette__name', entry.name));
    item.appendChild(el('span', 'emit-palette__path', entry.detail));
    palette.list.appendChild(item);
  });
  if (!palette.shown.length) palette.list.appendChild(el('li', 'emit-palette__empty', 'Nothing matches'));
  const current = palette.list.querySelector('[aria-selected="true"]');
  if (current) current.scrollIntoView({ block: 'nearest' });
}
