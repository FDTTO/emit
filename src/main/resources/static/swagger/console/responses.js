/*
 * What answers leave behind: credentials captured, ids carried, refusals
 * explained and runs started, as notes under the response.
 */
import {
  authorizeScheme,
  captureCredential,
  credentialSourceFor,
  expiryOf,
  heldCredential,
  openCredentialSource,
  scopeColor,
} from './auth.js';
import { el, icon } from './dom.js';
import { followNote, followOperation, resumeFollow, startFollow } from './follow.js';
import { openOperation } from './operations.js';
import { schedule } from './scheduler.js';
import { HTTP_METHODS, jsonBody, operationIndex, requiredSchemes, responseHeader } from './spec.js';
import { config, runtime } from './state.js';
import { checkHealth } from './statusbar.js';

/* A credential source hands over a credential, perhaps shown only once,
   and every create an id the item operations take in their path.
   
   Driven by the store: `responseFor()` returns the same immutable object
   until that response changes, so identity is enough to act once per
   response. One subscriber serves every handler. It needs `window.ui`,
   which springdoc creates on `load`, so it is attempted from the paint loop. */
let storeWatched = false;

const seenResponses = {};

export const responseNotes = {};

export function watchStore() {
  if (storeWatched) return;
  const ui = window.ui;
  if (
    !ui ||
    typeof ui.getStore !== 'function' ||
    !ui.specSelectors ||
    typeof ui.specSelectors.responseFor !== 'function' ||
    !ui.authActions ||
    !ui.specActions ||
    typeof ui.specActions.changeParamByIdentity !== 'function'
  )
    return;
  storeWatched = true;
  ui.getStore().subscribe(captureResponses);
}

/* Operations whose response can hand something on: the credential sources
   and every collection create with operations under `{id}`. Cached per spec,
   since the subscriber runs on every dispatch. */
let sourcesSpec = null;

let sourcesCache = [];

function responseSources() {
  if (sourcesSpec === runtime.spec) return sourcesCache;
  const byKey = {};
  config.credentialSources.forEach(function (source) {
    byKey[source.method.toUpperCase() + ' ' + source.path] = { method: source.method, path: source.path };
  });
  if (runtime.spec && runtime.spec.paths) {
    Object.keys(runtime.spec.paths).forEach(function (path) {
      if (runtime.spec.paths[path].post && path.indexOf('{') < 0 && carryTargets(path).length) {
        byKey['POST ' + path] = { method: 'post', path: path };
      }
    });
    const start = followOperation('start');
    if (start) byKey[start.method.toUpperCase() + ' ' + start.path] = { method: start.method, path: start.path };
    // Every guarded operation can be refused, and a refusal gets explained.
    Object.keys(runtime.spec.paths).forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        const operation = runtime.spec.paths[path][method];
        if (operation && requiredSchemes(operation).length) {
          byKey[method.toUpperCase() + ' ' + path] = { method: method, path: path };
        }
      });
    });
  }
  sourcesSpec = runtime.spec;
  sourcesCache = Object.keys(byKey).map(function (key) {
    return { key: key, method: byKey[key].method, path: byKey[key].path };
  });
  return sourcesCache;
}

function captureResponses() {
  const ui = window.ui;
  responseSources().forEach(function (source) {
    const response = ui.specSelectors.responseFor(source.path, source.method);
    if (!response || response === seenResponses[source.key]) return;
    seenResponses[source.key] = response;
    rememberAnswer(source.key, response);
    if (!response.get('status')) checkHealth();

    const ok = response.get('ok');
    const body = ok ? jsonBody(response) : null;
    const notes = {
      credential: body ? captureCredential(source.key, body) : null,
      carry: body ? carryId(source.path, body) : null,
      follow: ok ? startFollow(source, response) : resumeFollow(source, response),
      denied: ok ? null : captureDenial(source, response),
    };
    responseNotes[source.key] = notes.credential || notes.carry || notes.follow || notes.denied ? notes : null;
    schedule();
  });
}

/* The last answer each operation gave, and the latest of all: the rows, the
   map and the statusbar read these. */
export const lastAnswers = {};

function rememberAnswer(key, response) {
  const answer = {
    key: key,
    status: response.get('status'),
    duration: response.get('duration'),
    requestId: responseHeader(response, 'x-request-id'),
    limit: parseInt(responseHeader(response, 'ratelimit-limit'), 10),
    remaining: parseInt(responseHeader(response, 'ratelimit-remaining'), 10),
  };
  lastAnswers[key] = answer;
  runtime.latestAnswer = answer;
  /* The budget and the id outlive an answer that does not carry them: the
     budget is the caller's, and an answer without it says nothing about it. */
  if (!Number.isNaN(answer.limit) && !Number.isNaN(answer.remaining)) runtime.latestBudget = answer;
  if (answer.requestId) runtime.latestRequestId = answer.requestId;
}

/* A 401 or 403 does not say why. Record the scheme, what Authorize held when
   the call went out, and the API's message; the cause is decided at paint time. */
function captureDenial(source, response) {
  const status = response.get('status');
  if (status !== 401 && status !== 403) return null;
  const operation = runtime.spec && runtime.spec.paths[source.path] && runtime.spec.paths[source.path][source.method];
  const schemes = operation ? requiredSchemes(operation) : [];
  if (!schemes.length) return null;
  const body = jsonBody(response);
  return {
    scheme: schemes[0],
    sentWith: heldCredential(schemes[0]),
    message: body && typeof body.message === 'string' ? body.message : null,
    requestId: responseHeader(response, 'x-request-id'),
  };
}

/* Evaluated against Authorize now, so the note updates once the reader fixes
   the cause: missing, expired, refused as sent, or resolved. */
function denialState(denied) {
  const held = heldCredential(denied.scheme);
  if (!held) return 'missing';
  const expiresAt = expiryOf(held);
  if (expiresAt !== null && expiresAt <= Date.now()) return 'expired';
  return held === denied.sentWith ? 'refused' : 'resolved';
}

/* Operations under `<collection>/{id}` taking `id` as a path parameter, in
   page order (sorted by path), not spec order. */
function carryTargets(collection) {
  const prefix = collection + '/{id}';
  const targets = [];
  Object.keys(runtime.spec.paths).forEach(function (path) {
    if (path !== prefix && path.indexOf(prefix + '/') !== 0) return;
    HTTP_METHODS.forEach(function (method) {
      const operation = runtime.spec.paths[path][method];
      if (!operation || !operation.operationId) return;
      const takesId = (operation.parameters || []).some(function (parameter) {
        return parameter.name === 'id' && parameter.in === 'path';
      });
      if (!takesId) return;
      targets.push({
        path: path,
        method: method,
        summary: operation.summary || operation.operationId,
        tag: (operation.tags && operation.tags[0]) || 'default',
        id: operation.operationId,
      });
    });
  });
  return targets.sort(function (left, right) {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    return HTTP_METHODS.indexOf(left.method) - HTTP_METHODS.indexOf(right.method);
  });
}

/* Written through Swagger's parameter state, not the input, which only exists
   after Try it out and would be overwritten by React. Never overwrites a value
   the reader typed. */
export const carriedIds = {};

/* Where each carried id came from, named on the field it filled. */
export const carriedFrom = {};

function carryId(collection, body) {
  const id = typeof body.id === 'string' && body.id ? body.id : null;
  const targets = id ? carryTargets(collection) : [];
  if (!targets.length) return null;

  const ui = window.ui;
  const filled = [];
  const kept = [];
  targets.forEach(function (target) {
    const parameters = ui.specSelectors.specJson().getIn(['paths', target.path, target.method, 'parameters']);
    const parameter =
      parameters &&
      parameters.find(function (candidate) {
        return candidate.get('name') === 'id' && candidate.get('in') === 'path';
      });
    if (!parameter) return;

    const key = target.method + ' ' + target.path;
    const current = ui.specSelectors.parameterValues([target.path, target.method]).get('path.id');
    if (current && current !== carriedIds[key]) {
      kept.push(target);
      return;
    }
    ui.specActions.changeParamByIdentity([target.path, target.method], parameter, id);
    carriedIds[key] = id;
    const source = runtime.spec.paths[collection] && runtime.spec.paths[collection].post;
    carriedFrom[key] = source ? source.summary || source.operationId : null;
    filled.push(target);
  });
  return filled.length || kept.length ? { id: id, filled: filled, kept: kept } : null;
}

/* Derived from Authorize at paint time, never stored: a stored "applied"
   would survive a logout in the dialog. */
function noteState(note) {
  const held = heldCredential(note.source.scheme);
  if (held === note.value) return 'applied';
  return held ? 'offered' : null;
}

/* Notes go under "Server response", where the eye is after Execute. One
   slot per operation: one answer can hand on both a credential and an id. */
export function paintResponseNotes() {
  const index = operationIndex();
  Object.keys(responseNotes).forEach(function (key) {
    const target = index[key];
    if (!target) return;
    const block = document.getElementById('operations-' + target.tag + '-' + target.id);
    if (!block) return;

    let slot = block.querySelector('.emit-notes');
    const table = block.querySelector('.live-responses-table');
    const notes = responseNotes[key];
    const credentialState = notes && notes.credential ? noteState(notes.credential) : null;
    const carry = notes && notes.carry;
    const follow = notes && notes.follow;
    const deniedState = notes && notes.denied ? denialState(notes.denied) : null;
    if (!table || (!credentialState && !carry && !follow && !deniedState)) {
      if (slot) slot.remove();
      return;
    }

    const signature = [
      deniedState || '',
      credentialState || '',
      carry ? carry.id : '',
      follow ? follow.id + ':' + follow.state + ':' + follow.phase + ':' + follow.reads : '',
    ].join('|');
    if (slot && slot.dataset.signature === signature) return;
    if (slot) slot.remove();

    slot = el('div', 'emit-notes');
    slot.dataset.signature = signature;
    if (deniedState) slot.appendChild(denialNote(notes.denied, deniedState));
    if (credentialState) slot.appendChild(credentialNote(notes.credential, credentialState));
    if (carry) slot.appendChild(carryNote(carry));
    if (follow) slot.appendChild(followNote(follow));
    /* Over the result sheet, where the eye is after Execute. */
    const sheet = block.querySelector('.emit-result');
    if (sheet) sheet.parentNode.insertBefore(slot, sheet);
    else table.parentNode.insertBefore(slot, table);
  });
}

/* Names the missing credential and links to where it comes from; once a
   working one is held, says so instead. */
function requestRef(requestId) {
  const shown = 'request ' + requestId.slice(0, 8);
  const ref = el('button', 'emit-note__ref', shown);
  ref.type = 'button';
  ref.title = requestId + ' - click to copy';
  ref.dataset.requestId = requestId;
  ref.setAttribute('aria-label', 'Copy request id ' + requestId);
  ref.addEventListener('click', function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(requestId).then(function () {
      ref.textContent = 'copied';
      setTimeout(function () {
        ref.textContent = shown;
      }, 1200);
    });
  });
  return ref;
}

function denialNote(denied, state) {
  const scope = config.scopes[denied.scheme] || { key: 'other', label: denied.scheme, icon: null };
  const source = credentialSourceFor(denied.scheme);
  const noun = source ? source.noun : 'credential';
  const bar = el('div', 'emit-note emit-note--' + (state === 'resolved' ? scope.key : 'denied'));
  if (state === 'resolved') scopeColor(bar, scope);
  bar.dataset.state = state;
  bar.setAttribute('role', 'status');
  const glyph = scope.icon ? icon(scope.icon) : null;
  if (glyph) bar.appendChild(glyph);

  let said;
  let action = null;
  if (state === 'missing') {
    said = 'This operation needs ' + scope.label + ', and Authorize holds none.';
    action = source ? source.action : null;
  } else if (state === 'expired') {
    said = 'The ' + scope.label + ' ' + noun + ' has expired.';
    action = source ? source.action + ' again' : null;
  } else if (state === 'refused') {
    said = 'The API refused the ' + scope.label + ' ' + noun + (denied.message ? ': ' + denied.message : '.');
  } else {
    said = scope.label + ' is authorized now. Execute again.';
  }
  bar.appendChild(el('span', 'emit-note__text', said));
  /* The id the API logged this refusal under: short on screen, copied
     whole on click, so it can be quoted against the logs. */
  if (state !== 'resolved' && denied.requestId) bar.appendChild(requestRef(denied.requestId));
  if (action) {
    const button = el('button', 'emit-note__action', action);
    button.type = 'button';
    button.addEventListener('click', function () {
      openCredentialSource(denied.scheme);
    });
    bar.appendChild(button);
  }
  return bar;
}

function credentialNote(note, state) {
  const scope = config.scopes[note.source.scheme];
  const bar = scopeColor(el('div', 'emit-note emit-note--' + scope.key), scope);
  bar.dataset.state = state;
  bar.setAttribute('role', 'status');
  bar.appendChild(icon(scope.icon));

  if (state === 'applied') {
    const senders = sendersOf(note.source.scheme);
    bar.appendChild(
      el(
        'span',
        'emit-note__text',
        'Authorized as ' +
          scope.label +
          ' with this ' +
          note.source.noun +
          '.' +
          (senders ? ' ' + senders + ' operations will send it.' : ''),
      ),
    );
    return bar;
  }

  bar.appendChild(
    el('span', 'emit-note__text', 'Authorize already holds a different ' + scope.label + ' ' + note.source.noun + '.'),
  );
  const action = el('button', 'emit-note__action', 'Use this ' + note.source.noun);
  action.type = 'button';
  action.addEventListener('click', function () {
    authorizeScheme(note.source.scheme, note.value);
    schedule();
  });
  bar.appendChild(action);
  return bar;
}

/* The sections whose operations require a scheme, named the way a reader
   says them: the tag, singular. */
function sendersOf(scheme) {
  const tags = [];
  Object.keys(runtime.spec.paths).forEach(function (path) {
    HTTP_METHODS.forEach(function (method) {
      const operation = runtime.spec.paths[path][method];
      if (!operation || requiredSchemes(operation).indexOf(scheme) === -1) return;
      const tag = ((operation.tags && operation.tags[0]) || '').replace(/s$/, '');
      if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    });
  });
  return tags.join(' and ');
}

/* Each operation named links to it, with the id already in place. */
function carryNote(carry) {
  const bar = el('div', 'emit-note emit-note--carry');
  bar.setAttribute('role', 'status');
  bar.appendChild(icon('goTo'));
  const text = el('span', 'emit-note__text');
  if (carry.filled.length) {
    text.appendChild(document.createTextNode('Filled this id into '));
    appendOperationLinks(text, carry.filled);
    text.appendChild(document.createTextNode('.'));
  }
  if (carry.kept.length) {
    text.appendChild(
      document.createTextNode(
        (carry.filled.length ? ' ' : '') + (carry.kept.length > 1 ? 'Kept your own ids in ' : 'Kept your own id in '),
      ),
    );
    appendOperationLinks(text, carry.kept);
    text.appendChild(document.createTextNode('.'));
  }
  bar.appendChild(text);
  return bar;
}

function appendOperationLinks(parent, targets) {
  targets.forEach(function (target, position) {
    if (position) parent.appendChild(document.createTextNode(position === targets.length - 1 ? ' and ' : ', '));
    const link = el('button', 'emit-note__link', target.summary);
    link.type = 'button';
    link.addEventListener('click', function () {
      openOperation(target);
    });
    parent.appendChild(link);
  });
}
