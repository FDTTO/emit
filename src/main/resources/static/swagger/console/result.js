/*
 * The result of a call: how it went, and tabs for what came back.
 */
import { el, icon } from './dom.js';
import { renderJsonTree } from './json-tree.js';
import { HTTP_METHODS } from './spec.js';
import { config, runtime } from './state.js';

/* After Execute, one sheet says how the call went and tabs hold what came
   back: the body, the headers, the curl. It is the page's own markup, fed
   from Swagger's store; Swagger's live blocks stay mounted but hidden, as
   the source of the curl and of a binary body's download link. An operation
   with a request body then shows the request as it was sent, and Edit
   brings the editor back. */
const REASONS = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request',
  401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 415: 'Unsupported Media Type',
  429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' };

/* Amber is "wait, then retry": a 429 or a server error. */
/* A call that got no answer at all (the API down, the connection
   refused) has no status: it reads as wait, then retry, like a 5xx. */
export function toneOf(status) {
  return !status || status === 429 || status >= 500 ? 'wait' : status >= 400 ? 'bad' : 'ok';
}

export function statusWords(status) {
  return status ? String(status) : 'No answer';
}

export function apiAddress() {
  const first = runtime.spec && runtime.spec.servers && runtime.spec.servers[0];
  return first ? first.url : location.origin;
}

export function routeOf(block) {
  const path = block.querySelector('.opblock-summary-path');
  const method = HTTP_METHODS.filter(function (m) { return block.classList.contains('opblock-' + m); })[0];
  return path && method ? { path: path.getAttribute('data-path'), method: method } : null;
}

/* JSON drawn with keys, strings and numbers told apart, built as nodes so
   nothing the API returns is ever parsed as markup. */
const JSON_TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/g;

export function highlightJson(target, text) {
  target.textContent = '';
  let last = 0;
  text.replace(JSON_TOKEN, function (match, string, colon, literal, offset) {
    if (offset > last) target.appendChild(document.createTextNode(text.slice(last, offset)));
    target.appendChild(el('span', string ? (colon ? 'k' : 's') : 'n', string || literal));
    if (colon) target.appendChild(document.createTextNode(colon));
    last = offset + match.length;
    return match;
  });
  target.appendChild(document.createTextNode(text.slice(last)));
}

export function prettyJson(text, inline) {
  try {
    const value = JSON.parse(text);
    const spaced = JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ');
    return inline && spaced.length <= 90 ? spaced : JSON.stringify(value, null, 2);
  } catch (notJson) {
    return null;
  }
}

function headerList(response) {
  const headers = response.get('headers');
  const list = headers && headers.toJS ? headers.toJS() : headers || {};
  const names = Object.keys(list);
  const own = config.ownHeaders.filter(function (name) { return names.indexOf(name) !== -1; });
  return own.concat(names.filter(function (name) { return own.indexOf(name) === -1; })).map(function (name) {
    const value = list[name];
    return { name: name, value: Array.isArray(value) ? value.join(', ') : String(value) };
  });
}

export function tool(glyph, label, action) {
  const button = el('button', 'emit-tool');
  button.type = 'button';
  if (glyph) button.appendChild(icon(glyph));
  button.appendChild(el('span', null, label));
  button.addEventListener('click', action);
  return button;
}

function copyTool(text) {
  const button = tool('copy', 'Copy', function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text()).then(function () {
      button.lastChild.textContent = 'Copied';
      setTimeout(function () { button.lastChild.textContent = 'Copy'; }, 1200);
    });
  });
  return button;
}

function saveBody(block, body, type) {
  const id = block.id.replace(/^operations-[^-]+-/, '');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(body instanceof Blob ? body : new Blob([body], { type: type }));
  link.download = id + (/json/.test(type) ? '.json' : /pdf/.test(type) ? '.pdf' : '');
  link.click();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
}

function resultSheet(block, response, openTab) {
  const status = response.get('status');
  const body = response.get('text');
  const type = (headerList(response).filter(function (h) { return h.name === 'content-type'; })[0] || {}).value || '';
  const size = body instanceof Blob ? body.size : new Blob([body || '']).size;
  const requestId = (headerList(response).filter(function (h) { return h.name === 'x-request-id'; })[0] || {}).value;

  const sheet = el('div', 'emit-result');
  const head = el('div', 'emit-result__head');
  head.appendChild(el('span', 'emit-result__status emit-result__status--' + toneOf(status), statusWords(status) + (REASONS[status] ? ' ' + REASONS[status] : '')));
  const meta = el('span', 'emit-result__meta');
  [[response.get('duration'), 'ms'], [status ? size : null, 'B']].forEach(function (pair) {
    if (pair[0] == null) return;
    const item = el('span');
    item.appendChild(el('b', null, String(pair[0])));
    item.appendChild(document.createTextNode(' ' + pair[1]));
    meta.appendChild(item);
  });
  head.appendChild(meta);
  if (requestId) {
    const rid = el('button', 'emit-result__rid');
    rid.type = 'button';
    rid.title = 'Copy the request id';
    rid.appendChild(icon('copy'));
    const shown = requestId.length > 16 ? requestId.slice(0, 8) + '…' + requestId.slice(-6) : requestId;
    const label = rid.appendChild(el('span', null, shown));
    rid.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(requestId).then(function () {
        label.textContent = 'Copied';
        setTimeout(function () { label.textContent = shown; }, 1200);
      });
    });
    head.appendChild(rid);
  }

  const headers = headerList(response);
  const tabs = el('div', 'emit-tabs');
  tabs.setAttribute('role', 'tablist');
  const panels = {};
  [['body', 'Body'], ['headers', 'Headers', headers.length], ['curl', 'curl']].forEach(function (tab) {
    const button = el('button', null, tab[1]);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.dataset.tab = tab[0];
    if (tab[2]) button.appendChild(el('small', null, String(tab[2])));
    button.addEventListener('click', function () { choose(tab[0]); });
    tabs.appendChild(button);
  });
  head.appendChild(tabs);
  sheet.appendChild(head);

  const bodyPanel = el('div', 'emit-result__panel');
  const pretty = typeof body === 'string' ? prettyJson(body) : null;
  const pre = el('pre', 'emit-well');
  if (!status) {
    pre.classList.add('emit-well--words');
    pre.textContent = 'The API did not answer. The request never reached it at ' + apiAddress()
      + ': the application is not running there, or the connection was refused. Start it and Execute again.';
  }
  else if (pretty) renderJsonTree(pre, JSON.parse(body));
  else if (body instanceof Blob || !/json|text/.test(type)) pre.textContent = (type || 'binary') + ', ' + size + ' B. Save it to open it.';
  else pre.textContent = body || 'No body.';
  bodyPanel.appendChild(pre);
  const bodyTools = el('div', 'emit-result__tools');
  if (typeof body === 'string' && body) bodyTools.appendChild(copyTool(function () { return pretty || body; }));
  if (body && size) bodyTools.appendChild(tool('download', 'Save', function () { saveBody(block, body, type); }));
  bodyPanel.appendChild(bodyTools);
  panels.body = bodyPanel;

  const headersPanel = el('div', 'emit-result__panel');
  const grid = el('div', 'emit-kv');
  headers.forEach(function (header) {
    const hot = header.name === 'x-request-id' ? ' is-hot' : '';
    grid.appendChild(el('div', 'emit-kv__key' + hot, header.name));
    grid.appendChild(el('div', 'emit-kv__value' + hot, header.value));
  });
  headersPanel.appendChild(grid);
  headersPanel.appendChild(el('p', 'emit-result__explain',
    'The API’s own headers first, then the server’s standard ones.'));
  panels.headers = headersPanel;

  const curlPanel = el('div', 'emit-result__panel');
  const curl = block.querySelector('.curl-command pre');
  const curlText = curl ? curl.textContent : '';
  const curlPre = el('pre', 'emit-well');
  curlText.split(/('(?:[^'\\]|\\.)*')/).forEach(function (part, index) {
    curlPre.appendChild(index % 2 ? el('span', 's', part) : document.createTextNode(part));
  });
  curlPanel.appendChild(curlPre);
  const curlTools = el('div', 'emit-result__tools');
  curlTools.appendChild(copyTool(function () { return curlText; }));
  curlPanel.appendChild(curlTools);
  panels.curl = curlPanel;

  Object.keys(panels).forEach(function (key) { sheet.appendChild(panels[key]); });
  function choose(key) {
    sheet.dataset.tab = key;
    Array.prototype.forEach.call(tabs.children, function (button) {
      button.setAttribute('aria-selected', String(button.dataset.tab === key));
    });
    Object.keys(panels).forEach(function (name) { panels[name].hidden = name !== key; });
  }
  choose(openTab || 'body');
  return sheet;
}

export function paintResults() {
  if (!window.ui || !window.ui.specSelectors) return;
  document.querySelectorAll('.opblock').forEach(function (block) {
    const route = routeOf(block);
    const response = route && block.classList.contains('is-open') && window.ui.specSelectors.responseFor(route.path, route.method);
    let sheet = block.querySelector('.emit-result');
    const wrapper = block.querySelector('.responses-wrapper');
    if (!response || !response.get || !wrapper) {
      if (sheet) sheet.remove();
      block.classList.remove('emit-has-result', 'emit-editing');
      return;
    }
    const signature = [response.get('status'), response.get('duration'), headerList(response).map(function (h) { return h.value; }).join('|')].join(':');
    if (sheet && sheet.dataset.signature === signature) return;
    const openTab = sheet && sheet.dataset.tab;
    if (sheet) sheet.remove();
    sheet = resultSheet(block, response, openTab);
    sheet.dataset.signature = signature;
    wrapper.parentNode.insertBefore(sheet, wrapper);
    /* A new answer shows the request as it went. */
    block.classList.add('emit-has-result');
    block.classList.remove('emit-editing');
    paintSentBody(block, route);
  });
}

/* The request as it was sent, one line when it fits. */
function paintSentBody(block, route) {
  const section = block.querySelector('.opblock-section-request-body');
  if (!section) return;
  let sent = section.querySelector('.emit-sent');
  if (!sent) {
    sent = el('pre', 'emit-well emit-sent');
    section.appendChild(sent);
  }
  const request = window.ui.specSelectors.mutatedRequestFor(route.path, route.method);
  const body = request && request.get('body');
  const text = typeof body === 'string' ? (prettyJson(body, true) || body) : '';
  highlightJson(sent, text);
}
