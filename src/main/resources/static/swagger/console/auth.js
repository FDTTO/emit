/*
 * Credentials: the scopes an operation requires, what Swagger's store
 * holds and until when, and where a missing one comes from.
 */
import { el, icon } from './dom.js';
import { openOperation } from './operations.js';
import { responseNotes } from './responses.js';
import { schedule } from './scheduler.js';
import { operationIndex } from './spec.js';
import { config, runtime } from './state.js';

/* A scope's colour, from the configuration, as the --c every scope-marked
   element is drawn with; a scope without one keeps the element's own. */
export function scopeColor(element, scope) {
  if (scope && scope.color) element.style.setProperty('--c', scope.color);
  return element;
}

/* One badge builder for operation rows, the Authentication table and the
   credentials dialog. */
export function scopeBadge(scope) {
  const badge = scopeColor(el('span', 'emit-scope emit-scope--' + scope.key), scope);
  const glyph = scope.icon ? icon(scope.icon) : null;
  if (glyph) badge.appendChild(glyph);
  badge.appendChild(el('span', 'emit-scope__label', scope.label));
  return badge;
}

/* Operation-level security wins; otherwise the document default applies.
   An empty array means the endpoint is open. */
export function scopesFor(method, path) {
  if (!runtime.spec || !runtime.spec.paths) return null;
  const byPath = runtime.spec.paths[path];
  const op = byPath && byPath[method];
  if (!op) return null;

  const requirements = op.security !== undefined ? op.security : runtime.spec.security;
  if (!requirements) return null;
  if (!requirements.length) return [{ key: 'public', label: 'PUBLIC' }];

  const out = [];
  for (let i = 0; i < requirements.length; i++) {
    const names = Object.keys(requirements[i] || {});
    for (let j = 0; j < names.length; j++) {
      const known = config.scopes[names[j]];
      out.push(known || { key: 'other', label: names[j].toUpperCase() });
    }
  }
  return out;
}

/* Credentials currently held, read from Swagger's auth store through
 * `authSelectors`. Guarded on every hop: this script loads before
 * `window.ui` exists.
 */
export function authorizedScopes() {
  const ui = window.ui;
  const selectors = ui && ui.authSelectors;
  if (!selectors || typeof selectors.authorized !== 'function') return [];

  const held = selectors.authorized();
  if (!held || typeof held.entrySeq !== 'function') return [];

  return held.entrySeq().toArray()
    .map(function (entry) {
      const scope = config.scopes[entry[0]];
      if (!scope) return null;
      const value = entry[1] && entry[1].get ? entry[1].get('value') : null;
      return { scope: scope, expiresAt: expiryOf(value) };
    })
    .filter(Boolean);
}

/* Expiry read from the JWT's own `exp` (base64url, no call needed). Null for
   anything else, which is treated as live. */
export function expiryOf(value) {
  if (typeof value !== 'string') return null;
  const payload = value.split('.')[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payload.length + 3) % 4);
    const exp = JSON.parse(atob(padded)).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(held, now) {
  return held.expiresAt !== null && held.expiresAt <= now;
}

/* Expiry triggers no store event, so one timer repaints at the nearest
   expiry ahead. Re-aimed only when that target changes. */
let expiryTimer = null;

let expiryTarget = null;

const MAX_TIMER_MS = 2147483647;

export function armExpiry(held, now) {
  let next = null;
  held.forEach(function (h) {
    if (h.expiresAt !== null && h.expiresAt > now && (next === null || h.expiresAt < next)) next = h.expiresAt;
  });
  if (next === expiryTarget) return;
  expiryTarget = next;
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = next === null ? null : setTimeout(schedule, Math.min(next - now + 50, MAX_TIMER_MS));
}

export function credentialSourceFor(scheme) {
  return config.credentialSources.filter(function (source) { return source.scheme === scheme; })[0] || null;
}

/* Where a credential comes from: the operation whose answer hands it
   over, as the configuration names it. */
export function openCredentialSource(scheme) {
  const source = credentialSourceFor(scheme);
  const target = source && operationIndex()[source.method.toUpperCase() + ' ' + source.path];
  if (target) openOperation(target);
  return !!target;
}

/* An empty scheme is filled. One holding a different credential becomes an
   offer, since replacing it would silently switch identities. */
export function captureCredential(key, body) {
  const source = config.credentialSources.filter(function (candidate) {
    return candidate.method.toUpperCase() + ' ' + candidate.path === key;
  })[0];
  const value = source && typeof body[source.field] === 'string' ? body[source.field] : null;
  if (!value) return null;
  if (!heldCredential(source.scheme)) authorizeScheme(source.scheme, value);
  return { source: source, value: value };
}

export function heldCredential(scheme) {
  const held = window.ui.authSelectors.authorized();
  const entry = held && held.get ? held.get(scheme) : null;
  return entry && entry.get ? entry.get('value') : null;
}

/* Same call Swagger's own dialog makes. `authorizeWithPersistOption` writes
   the storage `persistAuthorization` restores from. The schema must be the
   store's immutable definition: persistence calls `schema.get("type")`. */
export function authorizeScheme(scheme, value) {
  const ui = window.ui;
  const definition = ui.specSelectors.securityDefinitions().get(scheme);
  if (!definition) return;
  const payload = {};
  payload[scheme] = { name: scheme, schema: definition, value: value };
  const authorize = ui.authActions.authorizeWithPersistOption || ui.authActions.authorize;
  authorize(payload);
}

/* Authorize as the credentials Execute sends: one card per scheme, its
   state first (held, where it came from, until when), and the way to get
   it when it is missing. The page draws it over the window and drives
   Swagger's own auth actions, so the store stays the one place a credential
   lives. */
export function schemeKind(definition) {
  const type = definition.get('type');
  if (type === 'http') return 'HTTP ' + (definition.get('scheme') || '').replace(/^\w/, function (c) { return c.toUpperCase(); });
  if (type === 'apiKey') return definition.get('name') + ' ' + definition.get('in');
  return type;
}

/* Filled from a response when what is held is what that response handed
   over; derived each time, like the notes, so a logout never leaves it. */
export function heldFrom(scheme, value) {
  const source = credentialSourceFor(scheme);
  const notes = source && responseNotes[source.method.toUpperCase() + ' ' + source.path];
  if (!notes || !notes.credential || notes.credential.value !== value) return null;
  const operation = runtime.spec.paths[source.path] && runtime.spec.paths[source.path][source.method];
  return operation ? operation.summary || operation.operationId : null;
}

export function masked(value) {
  return value.length > 40 ? value.slice(0, 20) + ' ··· ' + value.slice(-15)
    : value.slice(0, 6) + ' ··· ' + value.slice(-4);
}
