/*
 * Documented responses as an index of one line each.
 */
import { el } from './dom.js';
import { highlightJson, prettyJson } from './result.js';
import { examplesOf, operationFor } from './spec.js';
import { config, runtime } from './state.js';

export function paintResponseIndex() {
  if (!runtime.spec) return;
  document.querySelectorAll('.opblock.is-open').forEach(function (block) {
    const operation = operationFor(block);
    const table = block.querySelector('table.responses-table:not(.live-responses-table)');
    if (!operation || !table) return;

    const rows = table.querySelectorAll('tbody > tr.response');
    rows.forEach(function (row) {
      const code = row.getAttribute('data-code');
      const response = operation.responses[code] || {};
      const examples = examplesOf(response);
      row.classList.toggle(
        'emit-shared-member',
        examples.length > 0 &&
          examples.every(function (e) {
            return config.sharedRefusals.indexOf(e.name) !== -1;
          }),
      );

      const inner = row.querySelector('.response-col_description__inner');
      if (inner && !inner.querySelector('.emit-row-meta')) {
        const meta = examples.length > 1 ? examples.length + ' causes' : response.content ? '' : 'no body';
        inner.appendChild(el('span', 'emit-row-meta', meta));
        inner.appendChild(el('span', 'emit-row-chevron'));
        /* A run's start answers with no body: its row says where to read on. */
        const read = config.lifecycle && config.lifecycle.follow.read;
        if (!response.content && code.charAt(0) === '2' && isFollowStart(block)) {
          const note = el('div', 'emit-row-note', 'The run starts now. Read its state with ');
          note.appendChild(el('code', null, read.method.toUpperCase() + ' ' + read.path));
          note.appendChild(document.createTextNode('.'));
          inner.parentNode.appendChild(note);
        }
      }
      if (!row.dataset.emitIndexed) {
        row.dataset.emitIndexed = 'true';
        row.addEventListener('click', function (event) {
          if (event.target.closest('.response-col_status, .response-col_description__inner'))
            row.classList.toggle('emit-open');
        });
      }
    });
    /* What comes back is worth seeing at once where nothing is sent; an
       operation with a body already shows its editor. */
    if (!table.querySelector('tr.emit-open') && !table.dataset.emitDefaulted) {
      table.dataset.emitDefaulted = 'true';
      const success = table.querySelector('tbody > tr.response[data-code^="2"]');
      if (success && !block.querySelector('.opblock-section-request-body')) success.classList.add('emit-open');
    }
    table.querySelectorAll('tbody > tr.response.emit-open').forEach(paintRowExample);

    paintSharedRefusals(block, table, operation);
    paintHeadersOnce(block, table, operation);
  });
}

/* An open row's example, drawn in the page's own well from the text
   Swagger renders, so it takes the page's token colours; Swagger's block
   stays for the example picker to drive. */
function paintRowExample(row) {
  const source = row.querySelector('.model-example pre');
  const cell = row.querySelector('.response-col_description');
  if (!source || !cell) return;
  const text = source.textContent;
  let well = cell.querySelector('.emit-example');
  if (well && well.dataset.text === text) return;
  if (!well) well = cell.appendChild(el('pre', 'emit-well emit-example'));
  well.dataset.text = text;
  highlightJson(well, prettyJson(text) || text);
}

function isFollowStart(block) {
  if (!config.lifecycle) return false;
  const start = config.lifecycle.follow.start;
  const path = block.querySelector('.opblock-summary-path');
  return !!path && path.getAttribute('data-path') === start.path && block.classList.contains('opblock-' + start.method);
}

function paintSharedRefusals(block, table, operation) {
  if (block.querySelector('.emit-refusals')) return;
  const causes = [];
  Object.keys(operation.responses)
    .sort()
    .forEach(function (code) {
      examplesOf(operation.responses[code]).forEach(function (example) {
        if (config.sharedRefusals.indexOf(example.name) !== -1) {
          causes.push({ code: code, summary: example.summary, message: example.value.message || '' });
        }
      });
    });
  if (!causes.length) return;

  const tag = (operation.tags && operation.tags[0]) || '';
  const group = el('div', 'emit-refusals');
  const head = el('button', 'emit-refusals__head');
  head.type = 'button';
  head.appendChild(el('span', 'emit-refusals__dot'));
  head.appendChild(el('span', 'emit-refusals__code', '4XX'));
  head.appendChild(
    el('span', 'emit-refusals__title', 'Refusals every ' + tag.toLowerCase().replace(/s$/, '') + ' route shares'),
  );
  head.appendChild(el('span', 'emit-row-meta', causes.length + ' causes'));
  head.appendChild(el('span', 'emit-row-chevron'));
  head.addEventListener('click', function () {
    group.classList.toggle('emit-open');
  });
  group.appendChild(head);

  const list = el('table', 'emit-refusals__table');
  causes.forEach(function (cause) {
    const tr = el('tr', cause.code === '429' ? 'emit-refusals__row--wait' : null);
    tr.setAttribute('data-code', cause.code);
    tr.appendChild(el('td', 'emit-refusals__row-code', cause.code));
    tr.appendChild(el('td', 'emit-refusals__row-cause', cause.summary));
    tr.appendChild(el('td', 'emit-refusals__row-message', cause.message));
    list.appendChild(tr);
  });
  group.appendChild(list);
  table.parentNode.insertBefore(group, table.nextSibling);
}

/* Headers most responses share are said once, under the index. */
function paintHeadersOnce(block, table, operation) {
  if (block.querySelector('.emit-headers-once')) return;
  const codes = Object.keys(operation.responses);
  const withHeaders = codes.filter(function (code) {
    return operation.responses[code].headers;
  });
  if (!withHeaders.length) return;
  const shared = Object.keys(operation.responses[withHeaders[0]].headers).filter(function (name) {
    return withHeaders.every(function (code) {
      return operation.responses[code].headers[name];
    });
  });
  const without = codes.filter(function (code) {
    return withHeaders.indexOf(code) === -1;
  });

  const line = el('div', 'emit-headers-once');
  line.appendChild(
    document.createTextNode(
      (without.length ? 'Every response but ' + without.join(' and ') : 'Every response') + ' carries',
    ),
  );
  shared.forEach(function (name) {
    const header = operation.responses[withHeaders[0]].headers[name];
    const chip = el('code', null, name);
    chip.title =
      (header.description || '') + (header.schema && header.schema.type ? ' (' + header.schema.type + ')' : '');
    line.appendChild(chip);
  });
  /* A header only some answers add goes with them: on a shared refusal's
     own line when the code is one, on this line otherwise. */
  withHeaders.forEach(function (code) {
    Object.keys(operation.responses[code].headers).forEach(function (name) {
      if (shared.indexOf(name) !== -1) return;
      const chip = el('code', null, name);
      chip.title = operation.responses[code].headers[name].description || '';
      const refusal = block.querySelector(
        '.emit-refusals__table tr[data-code="' + code + '"] .emit-refusals__row-message',
      );
      if (refusal) {
        refusal.appendChild(chip);
        return;
      }
      line.appendChild(document.createTextNode(code + ' adds'));
      line.appendChild(chip);
    });
  });
  const after = block.querySelector('.emit-refusals') || table;
  after.parentNode.insertBefore(line, after.nextSibling);
}
