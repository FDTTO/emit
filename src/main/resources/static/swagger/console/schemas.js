/*
 * The schemas, drawn from the spec, with the operations that use each.
 */
import { el, icon, iconFor, plural } from './dom.js';
import { fieldRows } from './editor.js';
import { bringIntoView, openOperation } from './operations.js';
import { usersOf } from './spec.js';
import { runtime } from './state.js';

export function openModel(name) {
  const row = document.getElementById('emit-model-' + name);
  if (!row) return;
  row.classList.add('is-open');
  row.querySelector('.emit-model__head').setAttribute('aria-expanded', 'true');
  bringIntoView(row);
}

function modelRow(name, schema) {
  const row = el('article', 'emit-model');
  row.id = 'emit-model-' + name;
  const head = el('button', 'emit-model__head');
  head.type = 'button';
  head.setAttribute('aria-expanded', 'false');
  head.appendChild(el('span', 'emit-model__braces', '{}'));
  head.appendChild(el('span', 'emit-model__name', name));
  head.appendChild(el('span', 'emit-model__count', plural(Object.keys(schema.properties || {}).length, 'field')));
  head.appendChild(el('span', 'emit-chip emit-chip--type', schema.type || 'object'));
  head.appendChild(el('span', 'emit-model__chevron'));
  head.addEventListener('click', function () {
    const open = row.classList.toggle('is-open');
    head.setAttribute('aria-expanded', String(open));
  });
  row.appendChild(head);

  const body = el('div', 'emit-model__body');
  body.appendChild(fieldRows(schema));
  const users = usersOf(name);
  if (users.length) {
    const used = el('div', 'emit-model__used', 'Used by');
    users.forEach(function (user) {
      const link = el('button', 'emit-model__user');
      link.type = 'button';
      link.appendChild(icon(iconFor(user.method, user.path)));
      link.appendChild(document.createTextNode(user.method.toUpperCase() + ' ' + user.path));
      link.addEventListener('click', function () {
        openOperation(user);
      });
      used.appendChild(link);
    });
    body.appendChild(used);
  }
  row.appendChild(body);
  return row;
}

export function paintSchemas() {
  const schemas = runtime.spec && runtime.spec.components && runtime.spec.components.schemas;
  const models = document.querySelector('.swagger-ui section.models');
  if (!schemas || !models || document.getElementById('emit-schemas')) return;
  const holder = models.closest('.wrapper') || models;

  const section = el('section', 'emit-schemas');
  section.id = 'emit-schemas';
  const head = el('h3', 'emit-schemas__head', 'Schemas');
  head.appendChild(el('small', null, plural(Object.keys(schemas).length, 'model')));
  section.appendChild(head);
  Object.keys(schemas).forEach(function (name) {
    section.appendChild(modelRow(name, schemas[name]));
  });
  holder.parentNode.insertBefore(section, holder);
}
