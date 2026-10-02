/*
 * The request body editor: what was typed against the schema it must
 * match, the fields as rows, and ids carried in from earlier answers.
 */
import { el } from './dom.js';
import { carriedFrom, carriedIds } from './responses.js';
import { highlightJson, prettyJson, tool } from './result.js';
import { openModel } from './schemas.js';
import { modelOf, operationFor, operationIndex, requestSchemaOf } from './spec.js';
import { runtime } from './state.js';

export function setAreaValue(area, value) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, value);
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

/* What the reader has typed, against the schema the body must match. */
function validity(text, target) {
  let value;
  try { value = JSON.parse(text); } catch (error) { return { ok: false, words: 'Not valid JSON', detail: error.message.replace(/^JSON\.parse: /, '') }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, words: 'Not an object', detail: 'the body is one JSON object' };
  const fields = Object.keys(value);
  const detail = fields.length + (fields.length === 1 ? ' field' : ' fields');
  if (!target) return { ok: true, words: 'Valid JSON', detail: detail };
  const properties = target.schema.properties || {};
  const missing = (target.schema.required || []).filter(function (name) { return !(name in value); });
  const unknown = fields.filter(function (name) { return !properties[name]; });
  if (missing.length) return { ok: false, words: 'Valid JSON', detail: detail + ' · missing ' + missing.join(', ') };
  if (unknown.length) return { ok: false, words: 'Valid JSON', detail: detail + ' · ' + target.name + ' has no ' + unknown.join(', ') };
  return { ok: true, words: 'Valid JSON', detail: detail + ' · matches ' + target.name };
}

export function paintBodyEditors() {
  if (!runtime.spec) return;
  document.querySelectorAll('.opblock.is-open .opblock-section-request-body').forEach(function (section) {
    const block = section.closest('.opblock');
    const area = section.querySelector('textarea.body-param__text');
    const header = section.querySelector('.opblock-section-header');
    if (!area || !header) return;
    const target = requestSchemaOf(operationFor(block));

    if (!header.querySelector('.emit-body-tools')) {
      const type = el('span', 'emit-body-type', 'application/json');
      header.appendChild(type);
      const tools = el('div', 'emit-body-tools');
      const tabs = el('div', 'emit-tabs');
      ['Edit', 'Schema'].forEach(function (name) {
        const button = el('button', null, name);
        button.type = 'button';
        button.dataset.tab = name.toLowerCase();
        button.setAttribute('aria-selected', String(name === 'Edit'));
        button.addEventListener('click', function () {
          section.dataset.view = button.dataset.tab;
          Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', String(b === button)); });
        });
        tabs.appendChild(button);
      });
      tools.appendChild(tabs);
      tools.appendChild(tool('format', 'Format', function () {
        const pretty = prettyJson(area.value);
        if (pretty) setAreaValue(area, pretty);
      }));
      tools.appendChild(tool('reset', 'Reset to example', function () {
        const reset = block.querySelector('.try-out__btn.reset');
        if (reset) reset.click();
      }));
      tools.appendChild(tool('pencil', 'Edit', function () {
        block.classList.add('emit-editing');
        area.focus();
      })).classList.add('emit-tool--edit');
      header.appendChild(tools);
      if (target) section.appendChild(fieldRows(target.schema, 'emit-body-schema'));
    }

    const param = area.closest('.body-param');
    let gutter = param.querySelector('.emit-gutter');
    if (!gutter) {
      gutter = el('div', 'emit-gutter');
      gutter.setAttribute('aria-hidden', 'true');
      param.insertBefore(gutter, area);
      area.setAttribute('spellcheck', 'false');
      area.addEventListener('input', function () { paintBodyState(area, gutter, target); });
      /* The colours are a layer under the textarea, whose own text is
         transparent: typing, selection and undo stay the browser's. */
      const paint = el('pre', 'emit-paint');
      paint.setAttribute('aria-hidden', 'true');
      param.insertBefore(paint, area);
      area.addEventListener('scroll', function () { paint.scrollLeft = area.scrollLeft; });
    }
    paintBodyState(area, gutter, target);
  });
}

function paintBodyState(area, gutter, target) {
  const paint = area.parentNode.querySelector('.emit-paint');
  if (paint && paint.dataset.text !== area.value) {
    paint.dataset.text = area.value;
    /* A trailing newline needs a line after it to keep the heights equal. */
    highlightJson(paint, area.value + '\n');
    paint.scrollLeft = area.scrollLeft;
  }
  const lines = area.value.split('\n').length;
  if (gutter.dataset.lines !== String(lines)) {
    gutter.dataset.lines = String(lines);
    gutter.textContent = Array.apply(null, { length: lines }).map(function (_, i) { return i + 1; }).join('\n');
    area.style.height = 'auto';
    area.style.height = area.scrollHeight + 'px';
  }
  const param = area.closest('.body-param');
  let line = param.parentNode.querySelector('.emit-validity');
  if (!line) {
    line = el('div', 'emit-validity');
    param.parentNode.insertBefore(line, param.nextSibling);
  }
  const said = validity(area.value, target);
  const key = said.ok + said.words + said.detail;
  if (line.dataset.key === key) return;
  line.dataset.key = key;
  line.className = 'emit-validity' + (said.ok ? '' : ' is-bad');
  line.textContent = said.words + ' ';
  line.appendChild(el('span', null, '· ' + said.detail));
}

/* A schema's fields as rows: the name, required or not, its type and
   rules, what it means and an example. The Schemas section draws models
   the same way. */
export function fieldRows(schema, className) {
  const list = el('div', 'emit-fields' + (className ? ' ' + className : ''));
  const required = schema.required || [];
  Object.keys(schema.properties || {}).forEach(function (name) {
    const property = schema.properties[name];
    const row = el('div', 'emit-field');
    const label = el('div', 'emit-field__name', name);
    if (required.indexOf(name) !== -1) label.appendChild(el('i', null, '*'));
    row.appendChild(label);
    const about = el('div');
    const kind = el('div', 'emit-field__type');
    /* A field of another model's type names it and opens it. */
    const model = modelOf(property);
    const typed = property.$ref ? model
      : property.type === 'array' ? (model || (property.items && property.items.type) || 'item') + '[]'
      : property.type || 'object';
    const chip = kind.appendChild(el(model ? 'button' : 'span', 'emit-chip emit-chip--type', typed));
    if (model) {
      chip.type = 'button';
      chip.title = 'Open ' + model;
      chip.addEventListener('click', function () { openModel(model); });
    }
    if (property.format) kind.appendChild(el('span', 'emit-chip emit-chip--format', property.format));
    constraintsOf(property).forEach(function (rule) { kind.appendChild(el('span', 'emit-constraint', rule)); });
    about.appendChild(kind);
    if (property.description) about.appendChild(el('p', 'emit-field__about', property.description));
    if (property.example !== undefined) {
      const example = el('div', 'emit-field__example');
      example.appendChild(el('b', null, 'EXAMPLE'));
      example.appendChild(document.createTextNode(JSON.stringify(property.example)));
      about.appendChild(example);
    }
    row.appendChild(about);
    list.appendChild(row);
  });
  return list;
}

function constraintsOf(property) {
  const rules = [];
  if (property.minLength != null || property.maxLength != null) {
    rules.push(property.minLength != null && property.maxLength != null
      ? property.minLength + ' to ' + property.maxLength + ' characters'
      : property.minLength != null ? 'at least ' + property.minLength + ' characters' : 'up to ' + property.maxLength + ' characters');
  }
  if (property.pattern) rules.push('matches ' + property.pattern);
  if (property.enum) rules.push(property.enum.join(' | '));
  if (property.minimum != null) rules.push('at least ' + property.minimum);
  if (property.maximum != null) rules.push('at most ' + property.maximum);
  return rules;
}

/* A carried id names its source inside the field it filled, and the name
   goes as soon as the reader types something else. */
export function paintCarriedFields() {
  Object.keys(carriedIds).forEach(function (key) {
    const target = operationIndex()[key.split(' ')[0].toUpperCase() + ' ' + key.slice(key.indexOf(' ') + 1)];
    const block = target && document.getElementById('operations-' + target.tag + '-' + target.id);
    const cell = block && block.querySelector('tr[data-param-name="id"] .parameters-col_description');
    const input = cell && cell.querySelector('input');
    if (!input || !carriedFrom[key]) return;
    let chip = cell.querySelector('.emit-carried');
    if (!chip) {
      chip = el('span', 'emit-carried');
      cell.appendChild(chip);
      input.addEventListener('input', function () { chip.hidden = input.value !== carriedIds[key]; });
    }
    chip.textContent = 'from ' + carriedFrom[key];
    const path = key.slice(key.indexOf(' ') + 1);
    const value = window.ui.specSelectors.parameterValues([path, key.split(' ')[0]]).get('path.id');
    chip.hidden = value !== carriedIds[key];
  });
}

/* Read-only example boxes: size the disabled textarea to its content.
 * Stock pins it at min-height 280px. Editable ones are left alone, since
 * resizing under the cursor is worse.
 */
export function paintExampleBoxes() {
  document.querySelectorAll('.opblock textarea[disabled]').forEach(function (box) {
    const lines = (box.value || box.textContent || '').split('\n').length;
    const rows = Math.min(lines, 24);
    if (box.rows !== rows) box.rows = rows;
  });
}
