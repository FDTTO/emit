/* EMIT - Swagger UI runtime enhancements
 *
 * Only what depends on the DOM React renders; everything CSS can express
 * lives in theme.css. React replaces these nodes on every expand and
 * collapse, so every painter must be idempotent. Operation metadata comes
 * from the OpenAPI document, not from reading the page.
 */
(function () {
  'use strict';

  var SPEC_URL = '/v3/api-docs';

  /* ------------------------------------------------------------------ icons
   * 24 grid, 1.8 stroke, no fills.
   */
  var PATHS = {
    list:     ['M4 6h16M4 12h16M4 18h10'],
    doc:      ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
    docPlus:  ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M12 11v6M9 14h6'],
    bolt:     ['M13 2L4 14h7l-1 8 9-12h-7z'],
    download: ['M12 3v12M7 11l5 5 5-5', 'M4 20h16'],
    key:      ['M14 7a4 4 0 1 0-3.5 4L12 12.5V15h2v2h2v2h3v-3.5L14 11z'],
    powerOff: ['M12 4v8', 'M7.5 7a7 7 0 1 0 9 0'],
    restore:  ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
    trash:    ['M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13'],
    pencil:   ['M4 20h4L19 9l-4-4L4 16z'],
    building: ['M4 21V6l7-3 7 3v15', 'M9 21v-5h6v5', 'M8 10h2M14 10h2'],
    buildingPlus: ['M3 21V7l6-3 6 3v14', 'M7 21v-4h4v4', 'M6 11h2M12 11h2', 'M16 6h6M19 3v6'],
    /* Scope marks: shield for the admin credential, key for a tenant's. */
    shield: ['M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z'],
    apiKey: ['M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 12h9M18 12v4'],
    /* Topbar credential tag: open when empty, closed when holding a credential. */
    lockOpen:   ['M5 11h14v9H5z', 'M9 11V7a3 3 0 0 1 6 0'],
    lockClosed: ['M5 11h14v9H5z', 'M9 11V7a3 3 0 0 1 6 0v4'],
    /* Marks a getting-started step that leads to the operation it names. */
    goTo: ['M7 17L17 7', 'M8 7h9v9']
  };

  /* Action segments: the last path segment names what the call does. Verbs
     only: a resource name here makes GET and POST on the same path collide. */
  var ICON_BY_ACTION_SEGMENT = {
    pdf: 'download',
    generate: 'bolt',
    login: 'key',
    deactivate: 'powerOff',
    reactivate: 'restore'
  };

  /* Resource shapes: when the path names no action, the icon comes from the
     resource and whether the call targets the collection or one item. */
  var ICON_BY_RESOURCE = {
    documents: { list: 'list', item: 'doc', create: 'docPlus' },
    tenants: { list: 'list', item: 'building', create: 'buildingPlus' }
  };

  var ICON_BY_METHOD = {
    get: 'doc', post: 'docPlus', put: 'pencil', patch: 'pencil', delete: 'trash'
  };

  /* --------------------------------------------------------------- security
   * Unmapped schemes are shown under their own name, never hidden.
   */
  var SCOPE_BY_SCHEME = {
    bearerAuth: { key: 'admin', label: 'ADMIN', icon: 'shield' },
    apiKeyAuth: { key: 'tenant', label: 'TENANT', icon: 'apiKey' }
  };

  /* Responses that hand the reader a credential, and the scheme it is for.
     The spec cannot express that LoginResponse.token feeds bearerAuth. */
  var CREDENTIAL_SOURCES = [
    { method: 'post', path: '/v1/auth/login', field: 'token',  scheme: 'bearerAuth', noun: 'token', action: 'Log in' },
    { method: 'post', path: '/v1/tenants',    field: 'apiKey', scheme: 'apiKeyAuth', noun: 'key',   action: 'Register a tenant' }
  ];

  /* -------------------------------------------------------------- lifecycle
   * The transitions are not in the OpenAPI document. Rendering is gated on
   * the spec still declaring these states, so the figure cannot outlive the
   * enum.
   */
  var LIFECYCLE = {
    schema: 'DocumentResponse',
    field: 'status',
    run: [
      { state: 'PENDING', kind: 'pending', caption: 'persisted on create' },
      { via: 'kafka' },
      { state: 'PROCESSING', kind: 'processing', caption: 'worker picked up' },
      { via: 'render' }
    ],
    outcomes: [
      { state: 'DONE', kind: 'done', caption: 'pdf ready' },
      { state: 'FAILED', kind: 'failed', caption: 'retries exhausted' }
    ],
    /* The calls that start a run, read its state and collect the result.
       Checked against the spec before anything is followed. */
    follow: {
      start:  { method: 'post', path: '/v1/documents/{id}/generate' },
      read:   { method: 'get',  path: '/v1/documents/{id}' },
      result: { method: 'get',  path: '/v1/documents/{id}/pdf' }
    }
  };

  /* ------------------------------------------------------------- formats
   * Swagger renders a `format` and a real constraint through the same class,
   * `__constraint--<type>`, so formats are recognised by value. The set of
   * OpenAPI formats is fixed and short.
   */
  var OPENAPI_FORMATS = [
    'uuid', 'date', 'date-time', 'time', 'duration', 'password', 'byte',
    'binary', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uri-reference',
    'int32', 'int64', 'float', 'double'
  ];

  var spec = null;

  // ------------------------------------------------------------------ utils

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function icon(name) {
    var d = PATHS[name];
    if (!d) return null;
    var el = document.createElementNS(SVG_NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.8');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < d.length; i++) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d[i]);
      el.appendChild(p);
    }
    return el;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function iconFor(method, path) {
    var segments = path.split('/').filter(Boolean);
    var last = segments[segments.length - 1] || '';

    // What the call does beats what it addresses.
    if (ICON_BY_ACTION_SEGMENT[last]) return ICON_BY_ACTION_SEGMENT[last];

    // Otherwise: which resource, and is this the collection or one item.
    var isItem = last.indexOf('{') !== -1;
    var resource = ICON_BY_RESOURCE[isItem ? segments[segments.length - 2] : last];
    if (resource) {
      if (method === 'get') return isItem ? resource.item : resource.list;
      if (method === 'post' && !isItem) return resource.create;
      return resource.item;
    }

    // Unknown resource: the verb is the only honest signal left.
    if (method === 'get' && !isItem) return 'list';
    return ICON_BY_METHOD[method] || 'doc';
  }

  /* A path item also holds non-operation keys (`parameters`, `summary`,
     `servers`), so counting its keys would overcount. */
  var HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

  function operationCountByTag() {
    var counts = {};
    if (!spec || !spec.paths) return counts;
    Object.keys(spec.paths).forEach(function (path) {
      var item = spec.paths[path] || {};
      HTTP_METHODS.forEach(function (method) {
        var op = item[method];
        if (!op || !op.tags) return;
        op.tags.forEach(function (tag) { counts[tag] = (counts[tag] || 0) + 1; });
      });
    });
    return counts;
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* One badge builder for operation rows, the Authentication table and the
     Authorize dialog. */
  function scopeBadge(scope) {
    var badge = el('span', 'emit-scope emit-scope--' + scope.key);
    var glyph = scope.icon ? icon(scope.icon) : null;
    if (glyph) badge.appendChild(glyph);
    badge.appendChild(el('span', 'emit-scope__label', scope.label));
    return badge;
  }

  /* Operation-level security wins; otherwise the document default applies.
     An empty array means the endpoint is open. */
  function scopesFor(method, path) {
    if (!spec || !spec.paths) return null;
    var byPath = spec.paths[path];
    var op = byPath && byPath[method];
    if (!op) return null;

    var requirements = op.security !== undefined ? op.security : spec.security;
    if (!requirements) return null;
    if (!requirements.length) return [{ key: 'public', label: 'PUBLIC' }];

    var out = [];
    for (var i = 0; i < requirements.length; i++) {
      var names = Object.keys(requirements[i] || {});
      for (var j = 0; j < names.length; j++) {
        var known = SCOPE_BY_SCHEME[names[j]];
        out.push(known || { key: 'other', label: names[j].toUpperCase() });
      }
    }
    return out;
  }

  // --------------------------------------------------------------- painters

  /* Credentials currently held, read from Swagger's auth store through
   * `authSelectors`. Guarded on every hop: this script loads before
   * `window.ui` exists.
   */
  function authorizedScopes() {
    var ui = window.ui;
    var selectors = ui && ui.authSelectors;
    if (!selectors || typeof selectors.authorized !== 'function') return [];

    var held = selectors.authorized();
    if (!held || typeof held.entrySeq !== 'function') return [];

    return held.entrySeq().toArray()
      .map(function (entry) {
        var scope = SCOPE_BY_SCHEME[entry[0]];
        if (!scope) return null;
        var value = entry[1] && entry[1].get ? entry[1].get('value') : null;
        return { scope: scope, expiresAt: expiryOf(value) };
      })
      .filter(Boolean);
  }

  /* Expiry read from the JWT's own `exp` (base64url, no call needed). Null for
     anything else, which is treated as live. */
  function expiryOf(value) {
    if (typeof value !== 'string') return null;
    var payload = value.split('.')[1];
    if (!payload) return null;
    try {
      var padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payload.length + 3) % 4);
      var exp = JSON.parse(atob(padded)).exp;
      return typeof exp === 'number' ? exp * 1000 : null;
    } catch (ignored) {
      return null;
    }
  }

  function isExpired(held, now) {
    return held.expiresAt !== null && held.expiresAt <= now;
  }

  /* Expiry triggers no store event, so one timer repaints at the nearest
     expiry ahead. Re-aimed only when that target changes. */
  var expiryTimer = null;
  var expiryTarget = null;
  var MAX_TIMER_MS = 2147483647;

  function armExpiry(held, now) {
    var next = null;
    held.forEach(function (h) {
      if (h.expiresAt !== null && h.expiresAt > now && (next === null || h.expiresAt < next)) next = h.expiresAt;
    });
    if (next === expiryTarget) return;
    expiryTarget = next;
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = next === null ? null : setTimeout(schedule, Math.min(next - now + 50, MAX_TIMER_MS));
  }

  /* ------------------------------------------------ what a response hands on
   * Login returns a token, tenant registration an API key shown only once,
   * and every create an id the item operations take in their path.
   *
   * Driven by the store: `responseFor()` returns the same immutable object
   * until that response changes, so identity is enough to act once per
   * response. One subscriber serves every handler. It needs `window.ui`,
   * which springdoc creates on `load`, so it is attempted from the paint loop.
   */
  var storeWatched = false;
  var seenResponses = {};
  var responseNotes = {};

  function watchStore() {
    if (storeWatched) return;
    var ui = window.ui;
    if (!ui || typeof ui.getStore !== 'function' || !ui.specSelectors ||
        typeof ui.specSelectors.responseFor !== 'function' || !ui.authActions ||
        !ui.specActions || typeof ui.specActions.changeParamByIdentity !== 'function') return;
    storeWatched = true;
    ui.getStore().subscribe(captureResponses);
  }

  /* Operations whose response can hand something on: the credential sources
     and every collection create with operations under `{id}`. Cached per spec,
     since the subscriber runs on every dispatch. */
  var sourcesSpec = null;
  var sourcesCache = [];

  function responseSources() {
    if (sourcesSpec === spec) return sourcesCache;
    var byKey = {};
    CREDENTIAL_SOURCES.forEach(function (source) {
      byKey[source.method.toUpperCase() + ' ' + source.path] = { method: source.method, path: source.path };
    });
    if (spec && spec.paths) {
      Object.keys(spec.paths).forEach(function (path) {
        if (spec.paths[path].post && path.indexOf('{') < 0 && carryTargets(path).length) {
          byKey['POST ' + path] = { method: 'post', path: path };
        }
      });
      var start = followOperation('start');
      if (start) byKey[start.method.toUpperCase() + ' ' + start.path] = { method: start.method, path: start.path };
      // Every guarded operation can be refused, and a refusal gets explained.
      Object.keys(spec.paths).forEach(function (path) {
        HTTP_METHODS.forEach(function (method) {
          var operation = spec.paths[path][method];
          if (operation && requiredSchemes(operation).length) {
            byKey[method.toUpperCase() + ' ' + path] = { method: method, path: path };
          }
        });
      });
    }
    sourcesSpec = spec;
    sourcesCache = Object.keys(byKey).map(function (key) {
      return { key: key, method: byKey[key].method, path: byKey[key].path };
    });
    return sourcesCache;
  }

  function captureResponses() {
    var ui = window.ui;
    responseSources().forEach(function (source) {
      var response = ui.specSelectors.responseFor(source.path, source.method);
      if (!response || response === seenResponses[source.key]) return;
      seenResponses[source.key] = response;

      var ok = response.get('ok');
      var body = ok ? jsonBody(response) : null;
      var notes = {
        credential: body ? captureCredential(source.key, body) : null,
        carry: body ? carryId(source.path, body) : null,
        follow: ok ? startFollow(source, response) : null,
        denied: ok ? null : captureDenial(source, response)
      };
      responseNotes[source.key] = notes.credential || notes.carry || notes.follow || notes.denied ? notes : null;
      schedule();
    });
  }

  function requiredSchemes(operation) {
    var requirements = operation.security || spec.security || [];
    return requirements.length ? Object.keys(requirements[0]) : [];
  }

  /* A 401 or 403 does not say why. Record the scheme, what Authorize held when
     the call went out, and the API's message; the cause is decided at paint time. */
  function captureDenial(source, response) {
    var status = response.get('status');
    if (status !== 401 && status !== 403) return null;
    var operation = spec && spec.paths[source.path] && spec.paths[source.path][source.method];
    var schemes = operation ? requiredSchemes(operation) : [];
    if (!schemes.length) return null;
    var body = jsonBody(response);
    return {
      scheme: schemes[0],
      sentWith: heldCredential(schemes[0]),
      message: body && typeof body.message === 'string' ? body.message : null
    };
  }

  /* Evaluated against Authorize now, so the note updates once the reader fixes
     the cause: missing, expired, refused as sent, or resolved. */
  function denialState(denied) {
    var held = heldCredential(denied.scheme);
    if (!held) return 'missing';
    var expiresAt = expiryOf(held);
    if (expiresAt !== null && expiresAt <= Date.now()) return 'expired';
    return held === denied.sentWith ? 'refused' : 'resolved';
  }

  function credentialSourceFor(scheme) {
    return CREDENTIAL_SOURCES.filter(function (source) { return source.scheme === scheme; })[0] || null;
  }

  /* Where a credential comes from: login for the admin token, tenant
     registration for the API key. */
  function openCredentialSource(scheme) {
    var source = credentialSourceFor(scheme);
    var target = source && operationIndex()[source.method.toUpperCase() + ' ' + source.path];
    if (target) openOperation(target);
    return !!target;
  }

  function jsonBody(response) {
    try {
      var body = JSON.parse(response.get('text'));
      return body && typeof body === 'object' ? body : null;
    } catch (ignored) {
      return null;
    }
  }

  /* An empty scheme is filled. One holding a different credential becomes an
     offer, since replacing it would silently switch tenants. */
  function captureCredential(key, body) {
    var source = CREDENTIAL_SOURCES.filter(function (candidate) {
      return candidate.method.toUpperCase() + ' ' + candidate.path === key;
    })[0];
    var value = source && typeof body[source.field] === 'string' ? body[source.field] : null;
    if (!value) return null;
    if (!heldCredential(source.scheme)) authorizeScheme(source.scheme, value);
    return { source: source, value: value };
  }

  function heldCredential(scheme) {
    var held = window.ui.authSelectors.authorized();
    var entry = held && held.get ? held.get(scheme) : null;
    return entry && entry.get ? entry.get('value') : null;
  }

  /* Same call the Authorize dialog makes. `authorizeWithPersistOption` writes
     the storage `persistAuthorization` restores from. The schema must be the
     store's immutable definition: persistence calls `schema.get("type")`. */
  function authorizeScheme(scheme, value) {
    var ui = window.ui;
    var definition = ui.specSelectors.securityDefinitions().get(scheme);
    if (!definition) return;
    var payload = {};
    payload[scheme] = { name: scheme, schema: definition, value: value };
    var authorize = ui.authActions.authorizeWithPersistOption || ui.authActions.authorize;
    authorize(payload);
  }

  /* Operations under `<collection>/{id}` taking `id` as a path parameter, in
     page order (sorted by path), not spec order. */
  function carryTargets(collection) {
    var prefix = collection + '/{id}';
    var targets = [];
    Object.keys(spec.paths).forEach(function (path) {
      if (path !== prefix && path.indexOf(prefix + '/') !== 0) return;
      HTTP_METHODS.forEach(function (method) {
        var operation = spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        var takesId = (operation.parameters || []).some(function (parameter) {
          return parameter.name === 'id' && parameter.in === 'path';
        });
        if (!takesId) return;
        targets.push({
          path: path,
          method: method,
          summary: operation.summary || operation.operationId,
          tag: (operation.tags && operation.tags[0]) || 'default',
          id: operation.operationId
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
  var carriedIds = {};

  function carryId(collection, body) {
    var id = typeof body.id === 'string' && body.id ? body.id : null;
    var targets = id ? carryTargets(collection) : [];
    if (!targets.length) return null;

    var ui = window.ui;
    var filled = [];
    var kept = [];
    targets.forEach(function (target) {
      var parameters = ui.specSelectors.specJson().getIn(['paths', target.path, target.method, 'parameters']);
      var parameter = parameters && parameters.find(function (candidate) {
        return candidate.get('name') === 'id' && candidate.get('in') === 'path';
      });
      if (!parameter) return;

      var key = target.method + ' ' + target.path;
      var current = ui.specSelectors.parameterValues([target.path, target.method]).get('path.id');
      if (current && current !== carriedIds[key]) {
        kept.push(target);
        return;
      }
      ui.specActions.changeParamByIdentity([target.path, target.method], parameter, id);
      carriedIds[key] = id;
      filled.push(target);
    });
    return filled.length || kept.length ? { id: id, filled: filled, kept: kept } : null;
  }

  /* Derived from Authorize at paint time, never stored: a stored "applied"
     would survive a logout in the dialog. */
  function noteState(note) {
    var held = heldCredential(note.source.scheme);
    if (held === note.value) return 'applied';
    return held ? 'offered' : null;
  }

  /* ------------------------------------------------------------ live follow
   * After `generate` is accepted, read the document state back until it is
   * terminal. Reads spend the tenant's rate limit (20/min), so they back off:
   * 1s, 2s, 4s, then every 8s, eight at most. They stop at a terminal state,
   * a 429 or any failure, with a manual retry.
   */
  var FOLLOW_DELAYS = [1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000];
  var followRun = 0;

  /* Stops while `RateLimit-Remaining` still leaves the reader requests of
     their own this minute. */
  var FOLLOW_RESERVE = 2;

  function headerNumber(response, name) {
    var value = parseInt(response.headers.get(name), 10);
    return isNaN(value) ? null : value;
  }

  function followOperation(role) {
    var target = LIFECYCLE.follow && LIFECYCLE.follow[role];
    if (!target || !spec || !spec.paths || !spec.paths[target.path]) return null;
    return spec.paths[target.path][target.method] ? target : null;
  }

  function lifecycleStep(state) {
    return LIFECYCLE.run.concat(LIFECYCLE.outcomes).filter(function (step) {
      return step.state === state;
    })[0] || null;
  }

  function isTerminal(state) {
    return LIFECYCLE.outcomes.some(function (step) { return step.state === state; });
  }

  /* Starts at PENDING without a read: `generate` answers 409 in any other state.
     The id comes from the request URL, since a 202 has no body. */
  function startFollow(source, response) {
    var start = followOperation('start');
    if (!start || source.method !== start.method || source.path !== start.path) return null;
    var id = idFromUrl(start.path, response.get('url'));
    if (!id) return null;
    var follow = { id: id, state: LIFECYCLE.run[0].state, phase: 'following', reads: 0, run: 0,
                   acceptedAt: serverTime(response) };
    restartFollow(follow);
    return follow;
  }

  /* The server's clock when it answered, from the Date header: the run is
     timed on the server's clock at both ends, never against the reads'
     backoff. Whole seconds only. Swagger splits header values on commas,
     so "Sat, 19 Sep 2026 12:00:00 GMT" arrives as two parts. */
  function serverTime(response) {
    var headers = response.get('headers');
    var date = headers && (headers.get ? headers.get('date') : headers.date);
    if (date && typeof date.toArray === 'function') date = date.toArray();
    if (Array.isArray(date)) date = date.join(', ');
    var time = date ? Date.parse(date) : NaN;
    return isNaN(time) ? null : time;
  }

  /* The Date header truncates to the second, so the run took between
     (end - start - 1s) and (end - start); the midpoint is what is shown. */
  function runSeconds(follow) {
    if (follow.acceptedAt === null || !follow.finishedAt) return null;
    return Math.max(1, Math.round((follow.finishedAt - follow.acceptedAt) / 1000 - 0.5));
  }

  /* One document at a time: reads still pending for an older run are ignored. */
  function restartFollow(follow) {
    follow.run = ++followRun;
    follow.phase = 'following';
    scheduleRead(follow, 0);
  }

  function idFromUrl(template, url) {
    if (typeof url !== 'string') return null;
    var path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
    var parts = template.split('{id}');
    if (parts.length !== 2 || path.indexOf(parts[0]) !== 0) return null;
    if (path.lastIndexOf(parts[1]) !== path.length - parts[1].length) return null;
    var id = path.slice(parts[0].length, path.length - parts[1].length);
    return id && id.indexOf('/') < 0 ? decodeURIComponent(id) : null;
  }

  function scheduleRead(follow, attempt) {
    var run = follow.run;
    setTimeout(function () {
      if (follow.run === run) readState(follow, attempt);
    }, FOLLOW_DELAYS[attempt]);
  }

  function readState(follow, attempt) {
    var read = followOperation('read');
    var headers = read ? authHeaders(read) : null;
    if (!headers) {
      follow.phase = 'no-credential';
      schedule();
      return;
    }
    var run = follow.run;
    follow.reads++;
    fetch(read.path.replace('{id}', encodeURIComponent(follow.id)), { headers: headers, credentials: 'same-origin' })
      .then(function (response) {
        var budget = {
          remaining: headerNumber(response, 'RateLimit-Remaining'),
          retryAfter: headerNumber(response, 'Retry-After')
        };
        if (response.status !== 200) return { status: response.status, budget: budget };
        return response.json().then(function (body) { return { status: 200, body: body, budget: budget }; });
      })
      .then(function (result) {
        if (follow.run !== run) return;
        if (result.status === 429) {
          follow.phase = 'rate-limited';
          follow.retryAfter = result.budget.retryAfter;
          /* Resume after `Retry-After`. */
          if (follow.retryAfter) {
            setTimeout(function () {
              if (follow.run !== run) return;
              restartFollow(follow);
              schedule();
            }, follow.retryAfter * 1000);
          }
        } else if (result.status !== 200) {
          follow.phase = 'error';
          follow.httpStatus = result.status;
        } else {
          var state = result.body && result.body[LIFECYCLE.field];
          if (typeof state === 'string' && lifecycleStep(state)) follow.state = state;
          if (isTerminal(follow.state)) {
            follow.phase = 'ended';
            var finished = Date.parse(result.body.updatedAt);
            follow.finishedAt = isNaN(finished) ? null : finished;
          } else if (result.budget.remaining !== null && result.budget.remaining <= FOLLOW_RESERVE) {
            follow.phase = 'saving-budget';
            follow.remaining = result.budget.remaining;
          } else if (attempt + 1 >= FOLLOW_DELAYS.length) {
            follow.phase = 'paused';
          } else {
            scheduleRead(follow, attempt + 1);
          }
        }
        schedule();
      })
      .catch(function () {
        if (follow.run !== run) return;
        follow.phase = 'error';
        follow.httpStatus = null;
        schedule();
      });
  }

  /* Same credential Execute would send, from the operation's own security
     requirement and what Authorize holds. */
  function authHeaders(target) {
    var operation = spec.paths[target.path][target.method];
    var requirements = operation.security || spec.security || [];
    var schemes = (spec.components && spec.components.securitySchemes) || {};
    for (var i = 0; i < requirements.length; i++) {
      var names = Object.keys(requirements[i]);
      var headers = {};
      var complete = names.length > 0 && names.every(function (name) {
        var scheme = schemes[name];
        var value = heldCredential(name);
        if (!scheme || !value) return false;
        if (scheme.type === 'apiKey' && scheme.in === 'header') {
          headers[scheme.name] = value;
          return true;
        }
        if (scheme.type === 'http' && /^bearer$/i.test(scheme.scheme || '')) {
          headers.Authorization = 'Bearer ' + value;
          return true;
        }
        return false;
      });
      if (complete) return headers;
    }
    return null;
  }

  /* Passed states are quiet, the current one takes its lifecycle colour,
     unreached states are not drawn. */
  function stateTrail(state) {
    var trail = el('span', 'emit-note__trail');
    var order = LIFECYCLE.run.filter(function (step) { return step.state; });
    if (isTerminal(state)) order = order.concat([lifecycleStep(state)]);
    var reached = order.map(function (step) { return step.state; }).indexOf(state);
    order.slice(0, reached + 1).forEach(function (step, position) {
      if (position) trail.appendChild(el('span', 'emit-note__sep', '\u2192'));
      var mark = el('span', 'emit-note__state emit-note__state--' + step.kind, step.state);
      if (position < reached) mark.classList.add('is-past');
      trail.appendChild(mark);
    });
    return trail;
  }

  function followNote(follow) {
    var bar = el('div', 'emit-note emit-note--follow');
    bar.setAttribute('role', 'status');
    bar.appendChild(icon('bolt'));
    var text = el('span', 'emit-note__text');
    /* The id links to "Get document by ID", already filled in. */
    text.appendChild(document.createTextNode('Document '));
    var named = el('button', 'emit-note__link', follow.id.slice(0, 8));
    named.type = 'button';
    named.title = 'Open Get document by ID for ' + follow.id;
    named.addEventListener('click', function () { openFollowed('read', follow.id); });
    text.appendChild(named);
    text.appendChild(document.createTextNode(' '));
    text.appendChild(stateTrail(follow.state));
    bar.appendChild(text);

    var said = null;
    var action = null;
    if (follow.phase === 'following') {
      said = 'checking';
    } else if (follow.phase === 'ended' && follow.state === 'DONE' && followOperation('result')) {
      var took = runSeconds(follow);
      said = took ? 'PDF ready about ' + took + 's after generate.' : 'PDF ready.';
      action = el('button', 'emit-note__action', 'Download PDF');
      action.addEventListener('click', function () { openFollowed('result', follow.id); });
    } else if (follow.phase === 'ended') {
      var failedAfter = runSeconds(follow);
      said = follow.state !== 'FAILED' ? null
        : failedAfter ? 'Generation failed after about ' + failedAfter + 's.' : 'Generation failed.';
    } else if (follow.phase === 'paused') {
      said = 'Still ' + follow.state + ' after ' + follow.reads + ' checks.';
    } else if (follow.phase === 'rate-limited') {
      said = follow.retryAfter
        ? 'Rate limit reached; resuming in ' + follow.retryAfter + 's.'
        : 'Stopped: the tenant rate limit was reached.';
    } else if (follow.phase === 'saving-budget') {
      said = follow.remaining === 1
        ? 'Paused to leave your last request this minute.'
        : 'Paused to leave your last ' + follow.remaining + ' requests this minute.';
    } else if (follow.phase === 'error') {
      said = 'Stopped: reading it back returned ' + (follow.httpStatus || 'no response') + '.';
    } else if (follow.phase === 'no-credential') {
      said = 'Authorize holds no key to read it back with.';
    }
    if (said) bar.appendChild(el('span', 'emit-note__quiet', said));

    var resumesOnItsOwn = follow.phase === 'rate-limited' && follow.retryAfter;
    var stopped = ['paused', 'rate-limited', 'saving-budget', 'error'].indexOf(follow.phase) >= 0;
    if (!action && stopped && !resumesOnItsOwn) {
      action = el('button', 'emit-note__action', 'Check again');
      action.addEventListener('click', function () {
        restartFollow(follow);
        schedule();
      });
    }
    if (action) {
      action.type = 'button';
      bar.appendChild(action);
    }
    return bar;
  }

  /* Opens 'read' or 'result' for the followed document, not whatever id the
     field last held. */
  function openFollowed(role, id) {
    var operation = followOperation(role);
    if (!operation) return;
    var ui = window.ui;
    var parameters = ui.specSelectors.specJson().getIn(['paths', operation.path, operation.method, 'parameters']);
    var parameter = parameters && parameters.find(function (candidate) {
      return candidate.get('name') === 'id' && candidate.get('in') === 'path';
    });
    if (parameter) {
      ui.specActions.changeParamByIdentity([operation.path, operation.method], parameter, id);
      carriedIds[operation.method + ' ' + operation.path] = id;
    }
    var target = operationIndex()[operation.method.toUpperCase() + ' ' + operation.path];
    if (target) openOperation(target);
  }

  /* Lights the followed document's state on the lifecycle figure. */
  function paintLifecycleCurrent() {
    var current = null;
    Object.keys(responseNotes).forEach(function (key) {
      if (responseNotes[key] && responseNotes[key].follow) current = responseNotes[key].follow;
    });
    var step = current ? lifecycleStep(current.state) : null;
    document.querySelectorAll('#emit-lifecycle .emit-flow-node').forEach(function (node) {
      node.classList.toggle('is-current', !!step && node.classList.contains('emit-flow-node--' + step.kind));
    });
  }

  /* Notes go under "Server response", where the eye is after Execute. One
     slot per operation: tenant registration hands on both a key and an id. */
  function paintResponseNotes() {
    var index = operationIndex();
    Object.keys(responseNotes).forEach(function (key) {
      var target = index[key];
      if (!target) return;
      var block = document.getElementById('operations-' + target.tag + '-' + target.id);
      if (!block) return;

      var slot = block.querySelector('.emit-notes');
      var table = block.querySelector('.live-responses-table');
      var notes = responseNotes[key];
      var credentialState = notes && notes.credential ? noteState(notes.credential) : null;
      var carry = notes && notes.carry;
      var follow = notes && notes.follow;
      var deniedState = notes && notes.denied ? denialState(notes.denied) : null;
      if (!table || (!credentialState && !carry && !follow && !deniedState)) {
        if (slot) slot.remove();
        return;
      }

      var signature = [
        deniedState || '',
        credentialState || '',
        carry ? carry.id : '',
        follow ? follow.id + ':' + follow.state + ':' + follow.phase + ':' + follow.reads : ''
      ].join('|');
      if (slot && slot.dataset.signature === signature) return;
      if (slot) slot.remove();

      slot = el('div', 'emit-notes');
      slot.dataset.signature = signature;
      if (deniedState) slot.appendChild(denialNote(notes.denied, deniedState));
      if (credentialState) slot.appendChild(credentialNote(notes.credential, credentialState));
      if (carry) slot.appendChild(carryNote(carry));
      if (follow) slot.appendChild(followNote(follow));
      table.parentNode.insertBefore(slot, table);
    });
  }

  /* Names the missing credential and links to where it comes from; once a
     working one is held, says so instead. */
  function denialNote(denied, state) {
    var scope = SCOPE_BY_SCHEME[denied.scheme] || { key: 'other', label: denied.scheme, icon: null };
    var source = credentialSourceFor(denied.scheme);
    var noun = source ? source.noun : 'credential';
    var bar = el('div', 'emit-note emit-note--' + (state === 'resolved' ? scope.key : 'denied'));
    bar.dataset.state = state;
    bar.setAttribute('role', 'status');
    var glyph = scope.icon ? icon(scope.icon) : null;
    if (glyph) bar.appendChild(glyph);

    var said;
    var action = null;
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
    if (action) {
      var button = el('button', 'emit-note__action', action);
      button.type = 'button';
      button.addEventListener('click', function () { openCredentialSource(denied.scheme); });
      bar.appendChild(button);
    }
    return bar;
  }

  function credentialNote(note, state) {
    var scope = SCOPE_BY_SCHEME[note.source.scheme];
    var bar = el('div', 'emit-note emit-note--' + scope.key);
    bar.dataset.state = state;
    bar.setAttribute('role', 'status');
    bar.appendChild(icon(scope.icon));

    if (state === 'applied') {
      bar.appendChild(el('span', 'emit-note__text',
        'Authorized as ' + scope.label + ' with this ' + note.source.noun + '.'));
      return bar;
    }

    bar.appendChild(el('span', 'emit-note__text',
      'Authorize already holds a different ' + scope.label + ' ' + note.source.noun + '.'));
    var action = el('button', 'emit-note__action', 'Use this ' + note.source.noun);
    action.type = 'button';
    action.addEventListener('click', function () {
      authorizeScheme(note.source.scheme, note.value);
      schedule();
    });
    bar.appendChild(action);
    return bar;
  }

  /* Each operation named links to it, with the id already in place. */
  function carryNote(carry) {
    var bar = el('div', 'emit-note emit-note--carry');
    bar.setAttribute('role', 'status');
    bar.appendChild(icon('goTo'));
    var text = el('span', 'emit-note__text');
    if (carry.filled.length) {
      text.appendChild(document.createTextNode('Filled this id into '));
      appendOperationLinks(text, carry.filled);
      text.appendChild(document.createTextNode('.'));
    }
    if (carry.kept.length) {
      text.appendChild(document.createTextNode((carry.filled.length ? ' ' : '') +
        (carry.kept.length > 1 ? 'Kept your own ids in ' : 'Kept your own id in ')));
      appendOperationLinks(text, carry.kept);
      text.appendChild(document.createTextNode('.'));
    }
    bar.appendChild(text);
    return bar;
  }

  function appendOperationLinks(parent, targets) {
    targets.forEach(function (target, position) {
      if (position) parent.appendChild(document.createTextNode(position === targets.length - 1 ? ' and ' : ', '));
      var link = el('button', 'emit-note__link', target.summary);
      link.type = 'button';
      link.addEventListener('click', function () { openOperation(target); });
      parent.appendChild(link);
    });
  }

  /* Replaces the Swagger logo with the EMIT wordmark and mirrors Authorize in
     the topbar as a credential tag that shows what is held. */
  function paintTopbar() {
    var bar = document.querySelector('.topbar .topbar-wrapper');
    if (!bar) return;

    var link = bar.querySelector('a');
    if (link && !link.querySelector('.emit-brand')) {
      link.innerHTML = '<span class="emit-brand">EMIT<span style="color:rgba(156,220,254,0.6)">.</span></span>';
    }

    var source = document.querySelector('.scheme-container .auth-wrapper .authorize');
    var mirror = document.getElementById('emit-topbar-auth');
    if (!source) {
      if (mirror) mirror.remove();
      return;
    }
    if (!mirror) {
      mirror = document.createElement('button');
      mirror.id = 'emit-topbar-auth';
      mirror.type = 'button';
      /* Opens the dialog through `authActions.showDefinitions`, the documented
         entry point. Clicking the hidden stock button is only a fallback. */
      mirror.addEventListener('click', function () {
        /* Only expired credentials held: the way back is logging in again. */
        var held = authorizedScopes();
        var now = Date.now();
        if (held.length && held.every(function (h) { return isExpired(h, now); })) {
          var scheme = Object.keys(SCOPE_BY_SCHEME).filter(function (s) { return SCOPE_BY_SCHEME[s] === held[0].scope; })[0];
          if (openCredentialSource(scheme)) return;
        }
        var ui = window.ui;
        var actions = ui && ui.authActions;
        var selectors = ui && ui.authSelectors;
        if (actions && selectors && typeof selectors.definitionsToAuthorize === 'function') {
          actions.showDefinitions(selectors.definitionsToAuthorize());
          return;
        }
        var live = document.querySelector('.scheme-container .auth-wrapper .authorize');
        if (live) live.click();
      });
      bar.appendChild(mirror);
    }

    /* `data-state` names the credentials that still work and drives the tint;
       the key also tracks expiries. Rebuilt only when the key changes, or every
       mutation would restart the transitions. */
    var now = Date.now();
    var held = authorizedScopes();
    var live = held.filter(function (h) { return !isExpired(h, now); });
    var expired = held.filter(function (h) { return isExpired(h, now); });
    var labels = function (list) { return list.map(function (h) { return h.scope.label; }); };
    var key = held.map(function (h) { return h.scope.label + (isExpired(h, now) ? ':expired' : ''); }).join(',');
    armExpiry(held, now);
    if (mirror.dataset.key === key) return;
    mirror.dataset.key = key;
    /* Expired is not empty: the dialog still holds a token that will be rejected. */
    mirror.dataset.state = held.length && !live.length ? 'EXPIRED' : labels(live).join(',');
    mirror.textContent = '';

    if (!held.length) {
      var openWell = el('span', 'emit-auth-icon');
      openWell.appendChild(icon('lockOpen'));
      mirror.appendChild(openWell);
      mirror.appendChild(el('span', 'emit-auth-cta', 'Authorize'));
      mirror.setAttribute('aria-label', 'Authorize');
      mirror.title = 'Authorize';
      return;
    }

    /* One segment per credential, glyph and label from `SCOPE_BY_SCHEME`, divided
       by a hairline. Expired ones stay, dimmed and flagged: Authorize still sends
       them. */
    held.forEach(function (h) {
      var gone = isExpired(h, now);
      var seg = el('span', 'emit-auth-seg emit-auth-seg--' + h.scope.key + (gone ? ' emit-auth-seg--expired' : ''));
      if (h.scope.icon) seg.appendChild(icon(h.scope.icon));
      seg.appendChild(el('span', 'emit-auth-seg__label', h.scope.label));
      if (gone) seg.appendChild(el('span', 'emit-auth-seg__flag', 'expired'));
      mirror.appendChild(seg);
    });

    var said = [];
    if (live.length) said.push('Authorized as ' + labels(live).join(', ') + '.');
    expired.forEach(function (h) { said.push(h.scope.label + ' token expired.'); });
    var summary = said.join(' ');
    // Only a JWT carries an expiry, so "only expired" always means the admin
    // token, and the click leads to logging in again.
    var next = expired.length && !live.length ? 'log in again.' : expired.length ? 'authorize again.' : 'manage credentials.';
    mirror.setAttribute('aria-label', summary + ' ' + next.charAt(0).toUpperCase() + next.slice(1));
    mirror.title = summary + ' Click to ' + next;
  }

  /* The API title is one text node; split it into product name and
     descriptor. Scoped to the info panel, so the spec-failure heading is left
     alone. */
  function paintTitle() {
    var title = document.querySelector('.information-container .info .title');
    if (!title || title.querySelector('.emit-title-name')) return;

    for (var i = 0; i < title.childNodes.length; i++) {
      var node = title.childNodes[i];
      if (node.nodeType !== 3) continue;
      var words = node.textContent.trim().split(/\s+/);
      if (!words[0]) continue;

      var name = el('span', 'emit-title-name');
      name.appendChild(el('span', 'emit-title-mark', words.shift()));
      if (words.length) {
        /* The space belongs inside the descriptor, or it takes the mark's tracking. */
        name.appendChild(el('span', 'emit-title-kind', ' ' + words.join(' ')));
      }
      title.replaceChild(name, node);
      return;
    }
  }

  /* Response rows carry no status class; tag each by status band. */
  function paintResponseRows() {
    var rows = document.querySelectorAll('.responses-table tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i].querySelector('.response-col_status');
      if (!cell) continue;
      var code = parseInt(cell.textContent, 10);
      var band = code >= 200 && code < 300 ? 'resp-s2'
               : code === 429 ? 'resp-s5'
               : code >= 400 && code < 500 ? 'resp-s4'
               : code >= 500 ? 'resp-s5' : '';
      rows[i].classList.remove('resp-s2', 'resp-s4', 'resp-s5');
      if (band) rows[i].classList.add(band);
    }
  }

  /* Icon and scope badge per operation, matched on data-path, never on
     visible text. */
  function paintOperations() {
    var blocks = document.querySelectorAll('.opblock');
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var summary = block.querySelector('.opblock-summary');
      if (!summary) continue;

      var pathEl = summary.querySelector('.opblock-summary-path');
      var path = pathEl && pathEl.getAttribute('data-path');
      if (!path) continue;

      var methodEl = summary.querySelector('.opblock-summary-method');
      var method = methodEl ? methodEl.textContent.trim().toLowerCase() : '';
      if (!method) continue;

      var control = summary.querySelector('.opblock-summary-control');
      if (control && !control.querySelector('.emit-op-icon')) {
        var glyph = icon(iconFor(method, path));
        if (glyph) {
          var holder = el('span', 'emit-op-icon');
          holder.appendChild(glyph);
          control.insertBefore(holder, control.firstChild);
        }
      }

      if (!summary.querySelector('.emit-scopes')) {
        var scopes = scopesFor(method, path);
        if (scopes && scopes.length) {
          var group = el('span', 'emit-scopes');
          for (var s = 0; s < scopes.length; s++) {
            group.appendChild(scopeBadge(scopes[s]));
          }
          var anchor = summary.querySelector('.authorization__btn');
          if (anchor) summary.insertBefore(group, anchor);
          else summary.appendChild(group);
        }
      }
    }
  }

  /* The document lifecycle, drawn once under the info panel. */
  function lifecycleStatesMatchSpec() {
    if (!spec || !spec.components || !spec.components.schemas) return false;
    var schema = spec.components.schemas[LIFECYCLE.schema];
    var field = schema && schema.properties && schema.properties[LIFECYCLE.field];
    var declared = field && field.enum;
    if (!declared) return false;

    var named = LIFECYCLE.run.concat(LIFECYCLE.outcomes)
      .filter(function (step) { return step.state; })
      .map(function (step) { return step.state; });

    return named.every(function (state) { return declared.indexOf(state) !== -1; });
  }

  function lifecycleNode(step) {
    var node = el('div', 'emit-flow-node emit-flow-node--' + step.kind);
    node.appendChild(el('span', 'emit-flow-dot'));
    var text = el('span', 'emit-flow-text');
    text.appendChild(el('span', 'emit-flow-state', step.state));
    text.appendChild(el('span', 'emit-flow-caption', step.caption));
    node.appendChild(text);
    return node;
  }

  /* Enum values, inline on the property row.
   *
   * Swagger renders nothing for them while the property is collapsed, so the
   * values come from the spec. The row's schema is found by walking up to the
   * level-0 article; that is only sound one level down, so deeper rows keep
   * Swagger's own nested block.
   */
  function directTitle(article) {
    var title = article.querySelector(':scope > .json-schema-2020-12-head .json-schema-2020-12__title');
    return title ? (title.textContent || '').trim() : '';
  }

  /* The spec entry behind a property row, or null when the row is too deep. */
  function propertySchemaFor(article) {
    var schemas = spec && spec.components && spec.components.schemas;
    if (!schemas) return null;
    if (article.getAttribute('data-json-schema-level') !== '1') return null;

    var root = article.closest('article.json-schema-2020-12[data-json-schema-level="0"]');
    if (!root) return null;

    var schema = schemas[directTitle(root)];
    return (schema && schema.properties && schema.properties[directTitle(article)]) || null;
  }

  function enumValuesFor(article) {
    var property = propertySchemaFor(article);
    return property && property.enum && property.enum.length ? property.enum : null;
  }

  function paintEnums() {
    document.querySelectorAll('article.json-schema-2020-12--embedded').forEach(function (article) {
      var head = article.querySelector(':scope > .json-schema-2020-12-head');
      if (!head || head.querySelector('.emit-enum')) return;

      var values = enumValuesFor(article);
      if (!values) return;

      head.appendChild(el(
        'span',
        'json-schema-2020-12__constraint emit-constraint emit-enum',
        values.join(' | ')));
      /* Lets the stylesheet hide the duplicate nested block for this row only. */
      article.classList.add('emit-has-enum');
    });
  }

  /* Array properties: name the item type on the row instead of inlining the
   * item schema, which has its own card. Nested `Items -> scalar` rows repeat
   * what `array<string>` already says, so they go too.
   */
  function refName(ref) {
    return typeof ref === 'string' ? ref.split('/').pop() : '';
  }

  function paintArrays() {
    document.querySelectorAll('article.json-schema-2020-12--embedded').forEach(function (article) {
      var property = propertySchemaFor(article);
      if (!property || property.type !== 'array' || !property.items) return;

      var named = refName(property.items.$ref);
      if (named) {
        var attribute = article.querySelector(
          ':scope > .json-schema-2020-12-head .json-schema-2020-12__attribute--primary');
        var label = 'array<' + named + '>';
        /* Guarded on the text, not a marker class: React rewrites the label back to
           `array<object>` on re-render. */
        if (attribute && attribute.textContent !== label) attribute.textContent = label;
        /* Schema names keep their case (the stylesheet lowercases type pills). */
        if (attribute) attribute.classList.add('emit-type-name');
      } else if (!property.items.type) {
        return;
      }
      article.classList.add('emit-array');
    });
  }

  /* Mark format pills so the stylesheet can tell them from constraints. */
  function paintConstraintKinds() {
    var pills = document.querySelectorAll('.json-schema-2020-12__constraint');

    pills.forEach(function (pill) {
      if (pill.classList.contains('emit-format') || pill.classList.contains('emit-constraint')) return;
      var value = (pill.textContent || '').trim();
      pill.classList.add(OPENAPI_FORMATS.indexOf(value) === -1 ? 'emit-constraint' : 'emit-format');
    });
  }

  /* Getting-started steps that name a real operation become links to it.
   * The mapping comes from the spec, never from matching prose.
   */
  function operationIndex() {
    var index = {};
    if (!spec || !spec.paths) return index;

    Object.keys(spec.paths).forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        var operation = spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        var tag = (operation.tags && operation.tags[0]) || 'default';
        index[method.toUpperCase() + ' ' + path] = { tag: tag, id: operation.operationId };
      });
    });
    return index;
  }

  /* With `docExpansion: none` a collapsed tag has no operations in the DOM, so
     open the tag first and retry until React renders the target. */
  function openOperation(target) {
    var section = document.querySelector('h3.opblock-tag[data-tag="' + target.tag + '"]');
    if (section && section.getAttribute('data-is-open') === 'false') section.click();

    var attempts = 0;
    (function find() {
      var block = document.getElementById('operations-' + target.tag + '-' + target.id);
      if (!block) {
        if (attempts++ < 12) requestAnimationFrame(find);
        return;
      }
      if (!block.classList.contains('is-open')) {
        var control = block.querySelector('.opblock-summary-control');
        if (control) control.click();
      }
      block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();
  }

  function paintSteps() {
    var panel = document.querySelector('.information-container .info');
    if (!panel || !spec) return;

    var index = operationIndex();
    panel.querySelectorAll('li code').forEach(function (chip) {
      if (chip.dataset.emitStep) return;
      var target = index[(chip.textContent || '').trim()];
      if (!target) return;

      chip.dataset.emitStep = 'true';
      chip.classList.add('emit-step-link');
      chip.setAttribute('role', 'link');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('title', 'Open this operation');
      var mark = icon('goTo');
      if (mark) chip.appendChild(mark);
      chip.addEventListener('click', function () { openOperation(target); });
      chip.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openOperation(target);
      });
    });
  }

  /* Scope badges in the Authorize dialog, keyed by the scheme name it prints. */
  function paintAuthModal() {
    document.querySelectorAll('.dialog-ux .auth-container').forEach(function (container) {
      var head = container.querySelector('h4');
      if (!head || head.querySelector('.emit-scope')) return;

      var name = head.querySelector('code');
      var scope = name && SCOPE_BY_SCHEME[(name.textContent || '').trim()];
      if (!scope) return;

      head.insertBefore(scopeBadge(scope), head.firstChild);
    });
  }

  /* Read-only example boxes: size the disabled textarea to its content.
   * Stock pins it at min-height 280px. Editable ones are left alone, since
   * resizing under the cursor is worse.
   */
  function paintExampleBoxes() {
    document.querySelectorAll('.opblock textarea[disabled]').forEach(function (box) {
      var lines = (box.value || box.textContent || '').split('\n').length;
      var rows = Math.min(lines, 24);
      if (box.rows !== rows) box.rows = rows;
    });
  }

  /* Authentication table: the content stays in the OpenAPI description; the
   * first cell (a scheme name) is swapped for that scheme's badge.
   */
  function paintAuthMatrix() {
    var table = document.querySelector('.information-container .info table');
    if (!table || table.classList.contains('emit-matrix')) return;

    var rows = table.querySelectorAll('tbody tr');
    if (!rows.length) return;

    var painted = 0;
    rows.forEach(function (row) {
      var cell = row.querySelector('td');
      if (!cell) return;
      var scheme = SCOPE_BY_SCHEME[(cell.textContent || '').trim()];
      if (!scheme) return;
      cell.textContent = '';
      cell.appendChild(scopeBadge(scheme));
      painted++;
    });

    /* Claim the table only once a row resolved. */
    if (!painted) return;
    table.classList.add('emit-matrix');

    /* Own scroll frame for narrow screens. Safe to move: the description is
       markdown set as HTML, not nodes React reconciles. */
    var frame = el('div', 'emit-matrix-frame');
    table.parentNode.insertBefore(frame, table);
    frame.appendChild(table);
  }

  /* A region that scrolls sideways needs a tab stop to be scrolled by
   * keyboard; Chromium adds one on its own, other engines do not. Only while
   * it actually overflows, so a wide screen gains no empty tab stops.
   */
  var SCROLLER_LABELS = [
    ['.emit-matrix-frame', 'Authentication table'],
    ['pre.curl', 'curl command'],
    ['pre', 'Code']
  ];

  function paintScrollers() {
    SCROLLER_LABELS.forEach(function (entry) {
      document.querySelectorAll('#swagger-ui ' + entry[0]).forEach(function (region) {
        var overflowX = getComputedStyle(region).overflowX;
        var scrolls = (overflowX === 'auto' || overflowX === 'scroll')
          && region.scrollWidth > region.clientWidth + 1;
        var marked = region.hasAttribute('data-emit-scroller');
        if (scrolls && !marked) {
          region.setAttribute('data-emit-scroller', '');
          region.setAttribute('tabindex', '0');
          region.setAttribute('role', 'region');
          region.setAttribute('aria-label', entry[1] + ', scrolls horizontally');
        } else if (!scrolls && marked) {
          ['data-emit-scroller', 'tabindex', 'role', 'aria-label'].forEach(function (name) {
            region.removeAttribute(name);
          });
        }
      });
    });
  }

  /* Endpoint counts on group headers, from the spec: a collapsed tag renders
   * no operations, so a DOM count would read zero.
   */
  function paintGroupCounts() {
    var counts = operationCountByTag();

    document.querySelectorAll('.opblock-tag').forEach(function (header) {
      if (header.querySelector('.emit-count')) return;
      var total = counts[header.getAttribute('data-tag')];
      if (!total) return;

      var count = el('span', 'emit-count', plural(total, 'endpoint'));
      var chevron = header.querySelector('.expand-operation');
      if (chevron) header.insertBefore(count, chevron);
      else header.appendChild(count);
    });

    var control = document.querySelector('section.models .models-control');
    var schemas = spec && spec.components && spec.components.schemas;
    if (control && schemas && !control.querySelector('.emit-count')) {
      var models = Object.keys(schemas).length;
      if (models) {
        var label = el('span', 'emit-count', plural(models, 'model'));
        var arrow = control.querySelector('svg');
        if (arrow) control.insertBefore(label, arrow);
        else control.appendChild(label);
      }
    }
  }

  /* Where the figure goes: inside `.info` (a sibling of its <section> renders
   * as a second card), right after the lede. That is inside React's markdown
   * subtree, so a re-render can drop it; the id guard lets the next paint
   * restore it.
   */
  function lifecycleAnchor() {
    var markdown = document.querySelector(
      '.information-container .info .info__description .renderedMarkdown');
    if (!markdown) return null;
    var lede = markdown.querySelector(':scope > p');
    return { parent: markdown, before: lede ? lede.nextSibling : markdown.firstChild };
  }

  function paintLifecycle() {
    var anchor = lifecycleAnchor()
      /* No description rendered: fall back to the panel itself. */
      || (function () {
        var info = document.querySelector('.information-container .info');
        return info ? { parent: info, before: null } : null;
      })();

    if (!anchor || document.getElementById('emit-lifecycle')) return;
    if (!lifecycleStatesMatchSpec()) return;

    var section = el('div', null);
    section.id = 'emit-lifecycle';

    var label = el('div', 'emit-section-label');
    label.appendChild(el('span', null, 'Document lifecycle'));
    section.appendChild(label);

    var flow = el('div', 'emit-flow');
    LIFECYCLE.run.forEach(function (step) {
      if (step.via) {
        var link = el('div', 'emit-flow-link');
        link.appendChild(el('span', 'emit-flow-line'));
        link.appendChild(el('span', 'emit-flow-via', step.via));
        flow.appendChild(link);
      } else {
        flow.appendChild(lifecycleNode(step));
      }
    });

    var fork = el('div', 'emit-flow-fork');
    LIFECYCLE.outcomes.forEach(function (step) { fork.appendChild(lifecycleNode(step)); });
    flow.appendChild(fork);

    section.appendChild(flow);
    anchor.parent.insertBefore(section, anchor.before);
  }

  // -------------------------------------------------------------- scheduler

  function paint() {
    watchStore();
    paintTopbar();
    paintResponseNotes();
    paintLifecycleCurrent();
    paintTitle();
    paintResponseRows();
    paintOperations();
    paintGroupCounts();
    paintAuthMatrix();
    paintEnums();
    paintArrays();
    paintConstraintKinds();
    paintSteps();
    paintAuthModal();
    paintExampleBoxes();
    paintLifecycle();
    paintScrollers();
  }

  /* React rebuilds these nodes on expand and collapse, so repaint on mutation,
     one pass per frame. */
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      paint();
    });
  }

  function bindLegend() {
    var btn = document.getElementById('emit-legend-btn');
    var panel = document.getElementById('emit-legend-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = panel.dataset.open !== 'true';
      panel.dataset.open = String(open);
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  function start() {
    paint();
    bindLegend();

    var root = document.getElementById('swagger-ui');
    if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });

    /* Background tabs throttle timers; repaint when the tab comes back. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) schedule();
    });

    /* Whether a region overflows depends on the width, which no mutation reports. */
    window.addEventListener('resize', schedule);

    /* The badges and the figure need the spec; the page works without them. */
    fetch(SPEC_URL, { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (loaded) {
        if (!loaded) return;
        spec = loaded;
        schedule();
      })
      .catch(function () { /* the page is fully usable without the extras */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
