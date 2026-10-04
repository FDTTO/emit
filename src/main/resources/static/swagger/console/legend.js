/*
 * The legend: what each colour, chip and mark on the page means.
 */
import { scopeBadge } from './auth.js';
import { el } from './dom.js';
import { config } from './state.js';

/* How to read the page, in the page's own marks: what the colours of an
   answer mean (amber is wait, then retry), who may call, how a field is
   drawn, and the keys. A popover over the statusbar item that opens it. */
function legendRow(grid, mark, words, aside) {
  grid.appendChild(mark);
  const said = el('span', null, aside ? words + ' ' : words);
  if (aside) said.appendChild(el('small', null, '· ' + aside));
  grid.appendChild(said);
}

function legendSection(panel, title) {
  const section = panel.appendChild(el('section'));
  section.appendChild(el('div', 'emit-rail__label', title));
  return section.appendChild(el('div', 'emit-legend__grid'));
}

function outcome(label, tone) {
  return el('span', 'emit-legend__outcome emit-legend__outcome--' + tone, label);
}

export function buildLegend(win, status) {
  const button = el('button', 'emit-legend-btn', '∷ Legend');
  button.id = 'emit-legend-btn';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'emit-legend-panel');
  status.appendChild(button);

  const panel = el('div', 'emit-legend');
  panel.id = 'emit-legend-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Reading this page');
  panel.hidden = true;
  panel.appendChild(el('h3', null, 'Reading this page'));

  const outcomes = legendSection(panel, 'Outcomes');
  legendRow(outcomes, outcome('2xx', 'ok'), 'it worked');
  legendRow(outcomes, outcome('4xx', 'bad'), 'the call was refused', 'fix the request');
  const waiting = config.lifecycle
    ? config.lifecycle.run.filter(function (step) {
        return step.kind === 'pending';
      })
    : [];
  legendRow(
    outcomes,
    outcome('429', 'wait'),
    'wait, then retry',
    'also ' +
      ['5xx']
        .concat(
          waiting.map(function (step) {
            return step.state;
          }),
        )
        .join(' and '),
  );
  legendRow(outcomes, outcome('RUN', 'run'), 'work in progress');

  const who = legendSection(panel, 'Who may call');
  Object.keys(config.scopes).forEach(function (scheme) {
    legendRow(who, scopeBadge(config.scopes[scheme]), config.scopes[scheme].grants);
  });

  const fields = legendSection(panel, 'Fields');
  legendRow(fields, el('span', 'emit-chip emit-chip--type', 'string'), 'what the value is');
  legendRow(fields, el('span', 'emit-chip emit-chip--format', 'uuid'), 'how it is written');
  legendRow(fields, el('span', 'emit-constraint', '1 to 100'), 'a rule it must meet');
  const required = el('span', 'emit-field__name', 'name');
  required.appendChild(el('i', null, '*'));
  legendRow(fields, required, 'required');

  const keys = legendSection(panel, 'Keys');
  legendRow(keys, el('kbd', null, 'Ctrl K'), 'jump anywhere, run an action');
  legendRow(keys, el('kbd', null, 'J K'), 'walk the operations, Enter opens');
  legendRow(keys, el('kbd', null, 'Ctrl Enter'), 'execute the operation at hand');
  legendRow(keys, el('kbd', null, 'Ctrl B'), 'fold the rail');
  win.appendChild(panel);

  const toggle = function (open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('is-on', open);
  };
  button.addEventListener('click', function () {
    toggle(panel.hidden);
  });
  panel.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      toggle(false);
      button.focus();
    }
  });
  document.addEventListener('click', function (event) {
    if (!panel.hidden && !panel.contains(event.target) && event.target !== button) toggle(false);
  });
}
