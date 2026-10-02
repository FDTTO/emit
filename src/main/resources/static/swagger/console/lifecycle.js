/*
 * The lifecycle figure under the info panel, and the followed run on it.
 */
import { el } from './dom.js';
import { formatSpan, lifecycleStep, runStates, stageSpans } from './follow.js';
import { responseNotes } from './responses.js';
import { config, runtime } from './state.js';

/* Lights the followed run's state on the lifecycle figure. */
export function paintLifecycleCurrent() {
  let current = null;
  Object.keys(responseNotes).forEach(function (key) {
    if (responseNotes[key] && responseNotes[key].follow) current = responseNotes[key].follow;
  });
  const step = current ? lifecycleStep(current.state) : null;
  document.querySelectorAll('#emit-lifecycle .emit-flow-node').forEach(function (node) {
    const lit = !!step && node.classList.contains('emit-flow-node--' + step.kind);
    node.classList.toggle('is-current', lit);
    let tag = node.querySelector('.emit-flow-id');
    if (lit && !tag) tag = node.insertBefore(el('span', 'emit-flow-id'), node.firstChild);
    if (!tag) return;
    if (!lit && !tag.hasAttribute('data-reserved')) { tag.remove(); return; }
    tag.textContent = lit ? current.id.slice(0, 8) : '\u00a0';
  });
  /* While it runs, light travels the edge the run is crossing: out of the
     first state along the first, out of the second along the second. */
  const crossing = current && current.phase === 'following' ? runStates().indexOf(current.state) : -1;
  /* Once crossed, an edge says how long the crossing took. */
  const spans = current ? stageSpans(current) : {};
  const took = [spans.queued, spans.working];
  document.querySelectorAll('#emit-lifecycle .emit-flow-link').forEach(function (link, index) {
    link.classList.toggle('is-active', index === crossing);
    let time = link.querySelector('.emit-flow-time');
    const text = typeof took[index] === 'number' ? formatSpan(took[index]) : null;
    if (text && !time) time = link.querySelector('.emit-flow-via').appendChild(el('span', 'emit-flow-time'));
    if (time && !text) time.remove();
    if (time && text) time.textContent = text;
  });
}

/* The lifecycle, drawn once under the info panel. */
function lifecycleStatesMatchSpec() {
  if (!config.lifecycle || !runtime.spec || !runtime.spec.components || !runtime.spec.components.schemas) return false;
  const schema = runtime.spec.components.schemas[config.lifecycle.schema];
  const field = schema && schema.properties && schema.properties[config.lifecycle.field];
  const declared = field && field.enum;
  if (!declared) return false;

  const named = config.lifecycle.run.concat(config.lifecycle.outcomes)
    .filter(function (step) { return step.state; })
    .map(function (step) { return step.state; });

  return named.every(function (state) { return declared.indexOf(state) !== -1; });
}

/* A node keeps a line above its dot for the followed run's id, so
   lighting it moves nothing. The lower outcome has none: its id, when a run
   fails, takes the gap above it. */
function lifecycleNode(step, reserve) {
  const node = el('div', 'emit-flow-node emit-flow-node--' + step.kind);
  if (reserve) node.appendChild(el('span', 'emit-flow-id', '\u00a0')).setAttribute('data-reserved', '');
  node.appendChild(el('i', 'emit-flow-dot'));
  node.appendChild(el('b', 'emit-flow-state', step.state));
  node.appendChild(el('small', 'emit-flow-caption', step.caption));
  return node;
}

/* Where the figure goes: inside `.info` (a sibling of its <section> renders
 * as a second card), right after the lede. That is inside React's markdown
 * subtree, so a re-render can drop it; the id guard lets the next paint
 * restore it.
 */
function lifecycleAnchor() {
  const markdown = document.querySelector(
    '.information-container .info .info__description .renderedMarkdown');
  if (!markdown) return null;
  const lede = markdown.querySelector(':scope > p');
  return { parent: markdown, before: lede ? lede.nextSibling : markdown.firstChild };
}

export function paintLifecycle() {
  const anchor = lifecycleAnchor()
    /* No description rendered: fall back to the panel itself. */
    || (function () {
      const info = document.querySelector('.information-container .info');
      return info ? { parent: info, before: null } : null;
    })();

  if (!anchor || document.getElementById('emit-lifecycle')) return;
  if (!lifecycleStatesMatchSpec()) return;

  const section = el('div', null);
  section.id = 'emit-lifecycle';

  const label = el('div', 'emit-section-label');
  label.appendChild(el('span', null, config.lifecycle.title));
  section.appendChild(label);

  const flow = el('div', 'emit-flow');
  config.lifecycle.run.forEach(function (step) {
    if (!step.via) {
      flow.appendChild(lifecycleNode(step, true));
      return;
    }
    /* One grid item, so a time added beside the name stays on its line. */
    flow.appendChild(el('div', 'emit-flow-link')).appendChild(el('span', 'emit-flow-via', step.via));
  });

  const outcomes = el('div', 'emit-flow-outcomes');
  config.lifecycle.outcomes.forEach(function (step, index) {
    outcomes.appendChild(lifecycleNode(step, index < config.lifecycle.outcomes.length - 1));
  });
  flow.appendChild(outcomes);

  section.appendChild(flow);
  anchor.parent.insertBefore(section, anchor.before);
}
