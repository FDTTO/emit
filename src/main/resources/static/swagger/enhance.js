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
    goTo: ['M7 17L17 7', 'M8 7h9v9'],
    /* Rail: the overview entry and the collapse control. */
    home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
    chevronLeft: ['M15 6l-6 6 6 6'],
    search: ['M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M20 20l-4.5-4.5'],
    copy: ['M8 8h11v11H8z', 'M5 16V5h11'],
    format: ['M4 6h10M4 12h16M4 18h12'],
    reset: ['M4 12a8 8 0 1 0 2.34-5.66', 'M4 4v5h5'],
    pencil: ['M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z'],
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    close: ['M6 6l12 12M18 6L6 18'],
    braces: ['M8 4c-2 0-2 2-2 4s-2 4-2 4 2 2 2 4 0 4 2 4', 'M16 4c2 0 2 2 2 4s2 4 2 4-2 2-2 4 0 4-2 4']
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
    bearerAuth: { key: 'admin', label: 'ADMIN', icon: 'shield', serves: 'tenant management',
                  missing: 'the admin token, returned by Login' },
    apiKeyAuth: { key: 'tenant', label: 'TENANT', icon: 'apiKey', serves: 'documents',
                  missing: "a tenant's key, returned once when it is created" }
  };

  /* Responses that hand the reader a credential, and the scheme it is for.
     The spec cannot express that LoginResponse.token feeds bearerAuth. */
  var CREDENTIAL_SOURCES = [
    { method: 'post', path: '/v1/auth/login', field: 'token',  scheme: 'bearerAuth', noun: 'token', action: 'Log in' },
    { method: 'post', path: '/v1/tenants',    field: 'apiKey', scheme: 'apiKeyAuth', noun: 'key',   action: 'Create a tenant' }
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

  /* -------------------------------------------------------------- journey
   * The walkthrough the overview lists and the rail follows. A step is done
   * when the page can see it happened: a credential held, the run reaching
   * a state, or the operation answering with a 2xx. The first step not done
   * is the next one.
   */
  var JOURNEY = [
    { label: 'Log in', method: 'post', path: '/v1/auth/login', done: { held: 'bearerAuth' }, proof: 'token in Authorize' },
    { label: 'Create a tenant', method: 'post', path: '/v1/tenants', done: { held: 'apiKeyAuth' }, proof: 'key in Authorize' },
    { label: 'Create a document', method: 'post', path: '/v1/documents', done: { answered: true }, proof: 'id carried' },
    { label: 'Generate the PDF', method: 'post', path: '/v1/documents/{id}/generate', done: { run: 'DONE' }, proof: 'pdf ready' },
    { label: 'Download the PDF', method: 'get', path: '/v1/documents/{id}/pdf', done: { answered: true }, proof: 'downloaded' }
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
     credentials dialog. */
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
      rememberAnswer(source.key, response);

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

  /* The last answer each operation gave, and the latest of all: the rows, the
     map and the statusbar read these. */
  var lastAnswers = {};
  var latestAnswer = null;

  function rememberAnswer(key, response) {
    var answer = {
      key: key,
      status: response.get('status'),
      duration: response.get('duration'),
      requestId: responseHeader(response, 'x-request-id'),
      limit: parseInt(responseHeader(response, 'ratelimit-limit'), 10),
      remaining: parseInt(responseHeader(response, 'ratelimit-remaining'), 10)
    };
    lastAnswers[key] = answer;
    latestAnswer = answer;
    /* The budget and the id outlive an answer that does not carry them: the
       budget is the tenant's, and a 202 says nothing about it. */
    if (!isNaN(answer.limit) && !isNaN(answer.remaining)) latestBudget = answer;
    if (answer.requestId) latestRequestId = answer.requestId;
  }
  var latestBudget = null;
  var latestRequestId = null;

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
      message: body && typeof body.message === 'string' ? body.message : null,
      requestId: responseHeader(response, 'x-request-id')
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

  /* Same call Swagger's own dialog makes. `authorizeWithPersistOption` writes
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
  /* Where each carried id came from, named on the field it filled. */
  var carriedFrom = {};

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
      var source = spec.paths[collection] && spec.paths[collection].post;
      carriedFrom[key] = source ? source.summary || source.operationId : null;
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
    /* startedAt and endedAt are the browser's clock, for a timer that ticks;
       acceptedAt and finishedAt are the server's, for the duration reported. */
    var follow = { id: id, state: LIFECYCLE.run[0].state, phase: 'following', reads: 0, run: 0,
                   acceptedAt: serverTime(response), startedAt: Date.now(), endedAt: null };
    restartFollow(follow);
    return follow;
  }

  /* A header of a stored response, as one string. Swagger splits header
     values on commas, so "Sat, 19 Sep 2026 12:00:00 GMT" arrives as two
     parts and is joined back. */
  function responseHeader(response, name) {
    var headers = response.get('headers');
    var value = headers && (headers.get ? headers.get(name) : headers[name]);
    if (value && typeof value.toArray === 'function') value = value.toArray();
    if (Array.isArray(value)) value = value.join(', ');
    return typeof value === 'string' && value ? value : null;
  }

  /* The server's clock when it answered, from the Date header: the run is
     timed on the server's clock at both ends, never against the reads'
     backoff. Whole seconds only. */
  function serverTime(response) {
    var date = responseHeader(response, 'date');
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
            follow.endedAt = Date.now();
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
      carriedFrom[operation.method + ' ' + operation.path] = 'the followed run';
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
      var lit = !!step && node.classList.contains('emit-flow-node--' + step.kind);
      node.classList.toggle('is-current', lit);
      var tag = node.querySelector('.emit-flow-id');
      if (lit && !tag) tag = node.insertBefore(el('span', 'emit-flow-id'), node.firstChild);
      if (!tag) return;
      if (!lit && !tag.hasAttribute('data-reserved')) { tag.remove(); return; }
      tag.textContent = lit ? current.id.slice(0, 8) : '\u00a0';
    });
    /* While it runs, light travels the edge the document is crossing: out of
       PENDING along the first, out of PROCESSING along the second. */
    var crossing = current && current.phase === 'following'
      ? LIFECYCLE.run.filter(function (s) { return s.state; }).map(function (s) { return s.state; }).indexOf(current.state) : -1;
    document.querySelectorAll('#emit-lifecycle .emit-flow-link').forEach(function (link, index) {
      link.classList.toggle('is-active', index === crossing);
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
      /* Over the result sheet, where the eye is after Execute. */
      var sheet = block.querySelector('.emit-result');
      if (sheet) sheet.parentNode.insertBefore(slot, sheet);
      else table.parentNode.insertBefore(slot, table);
    });
  }

  /* Names the missing credential and links to where it comes from; once a
     working one is held, says so instead. */
  function requestRef(requestId) {
    var shown = 'request ' + requestId.slice(0, 8);
    var ref = el('button', 'emit-note__ref', shown);
    ref.type = 'button';
    ref.title = requestId + ' - click to copy';
    ref.dataset.requestId = requestId;
    ref.setAttribute('aria-label', 'Copy request id ' + requestId);
    ref.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(requestId).then(function () {
        ref.textContent = 'copied';
        setTimeout(function () { ref.textContent = shown; }, 1200);
      });
    });
    return ref;
  }

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
    /* The id the API logged this refusal under: short on screen, copied
       whole on click, so it can be quoted against the logs. */
    if (state !== 'resolved' && denied.requestId) bar.appendChild(requestRef(denied.requestId));
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
      var senders = sendersOf(note.source.scheme);
      bar.appendChild(el('span', 'emit-note__text',
        'Authorized as ' + scope.label + ' with this ' + note.source.noun + '.' +
        (senders ? ' ' + senders + ' operations will send it.' : '')));
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

  /* The sections whose operations require a scheme, named the way a reader
     says them: "Tenant", "Document". */
  function sendersOf(scheme) {
    var tags = [];
    Object.keys(spec.paths).forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        var operation = spec.paths[path][method];
        if (!operation || requiredSchemes(operation).indexOf(scheme) === -1) return;
        var tag = ((operation.tags && operation.tags[0]) || '').replace(/s$/, '');
        if (tag && tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    return tags.join(' and ');
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
      link.innerHTML = '<span class="emit-brand">EMIT<span class="emit-brand__dot">.</span></span>';
    }
    if (!document.getElementById('emit-crumb')) {
      var crumb = el('div', 'emit-crumb');
      crumb.id = 'emit-crumb';
      bar.insertBefore(crumb, link ? link.nextSibling : bar.firstChild);
    }
    if (!document.getElementById('emit-rail-toggle')) {
      var fold = el('button', 'emit-rail-toggle');
      fold.id = 'emit-rail-toggle';
      fold.type = 'button';
      fold.title = 'Fold the rail (Ctrl B)';
      fold.setAttribute('aria-label', 'Fold the rail');
      fold.appendChild(icon('chevronLeft'));
      fold.addEventListener('click', toggleRail);
      bar.insertBefore(fold, document.getElementById('emit-crumb'));
    }
    if (!document.getElementById('emit-jump')) {
      var jump = el('button', 'emit-jump');
      jump.id = 'emit-jump';
      jump.type = 'button';
      jump.appendChild(icon('search'));
      jump.appendChild(el('span', null, 'Jump to an operation'));
      jump.appendChild(el('kbd', null, 'Ctrl K'));
      jump.addEventListener('click', openPalette);
      bar.insertBefore(jump, document.getElementById('emit-crumb').nextSibling);
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
      mirror.addEventListener('click', function () {
        /* Only expired credentials held: the way back is logging in again. */
        var held = authorizedScopes();
        var now = Date.now();
        if (held.length && held.every(function (h) { return isExpired(h, now); })) {
          var scheme = Object.keys(SCOPE_BY_SCHEME).filter(function (s) { return SCOPE_BY_SCHEME[s] === held[0].scope; })[0];
          if (openCredentialSource(scheme)) return;
        }
        openCredentials();
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
    /* Expired is not empty: Execute would still send a token that will be rejected. */
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
          /* Before the arrow, so the badge sits in the same place on public
             operations, which have no padlock button to anchor on. */
          var anchor = summary.querySelector('.authorization__btn') || summary.querySelector('.opblock-control-arrow');
          if (anchor) summary.insertBefore(group, anchor);
          else summary.appendChild(group);
        }
      }
    }
  }

  /* --------------------------------------------------------- response index
   * Responses read as an index: one line each, details on demand. Refusals
   * that every guarded route shares are named by these example keys in the
   * spec and are listed once per operation instead of one row per code.
   */
  var SHARED_REFUSALS = ['missing-credential', 'invalid-api-key', 'invalid-token',
    'wrong-credential', 'tenant-inactive', 'rate-limited', 'invalid-id'];

  function operationFor(block) {
    var path = block.querySelector('.opblock-summary-path');
    var method = block.querySelector('.opblock-summary-method');
    var item = spec && path && spec.paths[path.getAttribute('data-path')];
    return item && method ? item[method.textContent.trim().toLowerCase()] : null;
  }

  function examplesOf(response) {
    var media = response && response.content && response.content['application/json'];
    var examples = media && media.examples;
    return examples ? Object.keys(examples).map(function (name) {
      return { name: name, summary: examples[name].summary || name, value: examples[name].value || {} };
    }) : [];
  }

  function paintResponseIndex() {
    if (!spec) return;
    document.querySelectorAll('.opblock.is-open').forEach(function (block) {
      var operation = operationFor(block);
      var table = block.querySelector('table.responses-table:not(.live-responses-table)');
      if (!operation || !table) return;

      var rows = table.querySelectorAll('tbody > tr.response');
      rows.forEach(function (row) {
        var code = row.getAttribute('data-code');
        var response = operation.responses[code] || {};
        var examples = examplesOf(response);
        row.classList.toggle('emit-shared-member', examples.length > 0 && examples.every(function (e) {
          return SHARED_REFUSALS.indexOf(e.name) !== -1;
        }));

        var inner = row.querySelector('.response-col_description__inner');
        if (inner && !inner.querySelector('.emit-row-meta')) {
          var meta = examples.length > 1 ? examples.length + ' causes' : response.content ? '' : 'no body';
          inner.appendChild(el('span', 'emit-row-meta', meta));
          inner.appendChild(el('span', 'emit-row-chevron'));
          /* A run's start answers with no body: its row says where to read on. */
          var read = LIFECYCLE.follow.read;
          if (!response.content && code.charAt(0) === '2' && isFollowStart(block)) {
            var note = el('div', 'emit-row-note', 'The run starts now. Read its state with ');
            note.appendChild(el('code', null, read.method.toUpperCase() + ' ' + read.path));
            note.appendChild(document.createTextNode('.'));
            inner.parentNode.appendChild(note);
          }
        }
        if (!row.dataset.emitIndexed) {
          row.dataset.emitIndexed = 'true';
          row.addEventListener('click', function (event) {
            if (event.target.closest('.response-col_status, .response-col_description__inner')) row.classList.toggle('emit-open');
          });
        }
      });
      /* What comes back is worth seeing at once where nothing is sent; an
         operation with a body already shows its editor. */
      if (!table.querySelector('tr.emit-open') && !table.dataset.emitDefaulted) {
        table.dataset.emitDefaulted = 'true';
        var success = table.querySelector('tbody > tr.response[data-code^="2"]');
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
    var source = row.querySelector('.model-example pre');
    var cell = row.querySelector('.response-col_description');
    if (!source || !cell) return;
    var text = source.textContent;
    var well = cell.querySelector('.emit-example');
    if (well && well.dataset.text === text) return;
    if (!well) well = cell.appendChild(el('pre', 'emit-well emit-example'));
    well.dataset.text = text;
    highlightJson(well, prettyJson(text) || text);
  }

  function isFollowStart(block) {
    var start = LIFECYCLE.follow.start;
    var path = block.querySelector('.opblock-summary-path');
    return !!path && path.getAttribute('data-path') === start.path && block.classList.contains('opblock-' + start.method);
  }

  function paintSharedRefusals(block, table, operation) {
    if (block.querySelector('.emit-refusals')) return;
    var causes = [];
    Object.keys(operation.responses).sort().forEach(function (code) {
      examplesOf(operation.responses[code]).forEach(function (example) {
        if (SHARED_REFUSALS.indexOf(example.name) !== -1) {
          causes.push({ code: code, summary: example.summary, message: example.value.message || '' });
        }
      });
    });
    if (!causes.length) return;

    var tag = (operation.tags && operation.tags[0]) || '';
    var group = el('div', 'emit-refusals');
    var head = el('button', 'emit-refusals__head');
    head.type = 'button';
    head.appendChild(el('span', 'emit-refusals__dot'));
    head.appendChild(el('span', 'emit-refusals__code', '4XX'));
    head.appendChild(el('span', 'emit-refusals__title',
      'Refusals every ' + tag.toLowerCase().replace(/s$/, '') + ' route shares'));
    head.appendChild(el('span', 'emit-row-meta', causes.length + ' causes'));
    head.appendChild(el('span', 'emit-row-chevron'));
    head.addEventListener('click', function () { group.classList.toggle('emit-open'); });
    group.appendChild(head);

    var list = el('table', 'emit-refusals__table');
    causes.forEach(function (cause) {
      var tr = el('tr', cause.code === '429' ? 'emit-refusals__row--wait' : null);
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
    var codes = Object.keys(operation.responses);
    var withHeaders = codes.filter(function (code) { return operation.responses[code].headers; });
    if (!withHeaders.length) return;
    var shared = Object.keys(operation.responses[withHeaders[0]].headers).filter(function (name) {
      return withHeaders.every(function (code) { return operation.responses[code].headers[name]; });
    });
    var without = codes.filter(function (code) { return withHeaders.indexOf(code) === -1; });

    var line = el('div', 'emit-headers-once');
    line.appendChild(document.createTextNode((without.length ? 'Every response but ' + without.join(' and ') : 'Every response') + ' carries'));
    shared.forEach(function (name) {
      var header = operation.responses[withHeaders[0]].headers[name];
      var chip = el('code', null, name);
      chip.title = (header.description || '') + (header.schema && header.schema.type ? ' (' + header.schema.type + ')' : '');
      line.appendChild(chip);
    });
    /* A header only some answers add goes with them: on a shared refusal's
       own line when the code is one, on this line otherwise. */
    withHeaders.forEach(function (code) {
      Object.keys(operation.responses[code].headers).forEach(function (name) {
        if (shared.indexOf(name) !== -1) return;
        var chip = el('code', null, name);
        chip.title = operation.responses[code].headers[name].description || '';
        var refusal = block.querySelector('.emit-refusals__table tr[data-code="' + code + '"] .emit-refusals__row-message');
        if (refusal) {
          refusal.appendChild(chip);
          return;
        }
        line.appendChild(document.createTextNode(code + ' adds'));
        line.appendChild(chip);
      });
    });
    var after = block.querySelector('.emit-refusals') || table;
    after.parentNode.insertBefore(line, after.nextSibling);
  }

  /* --------------------------------------------------------------- schemas
   * The models read like operations: a row each until chosen, the fields as
   * rows, and the operations that use the model, each a link. Drawn from the
   * spec in place of Swagger's section, which stays hidden.
   */
  function refName(ref) {
    return typeof ref === 'string' ? ref.split('/').pop() : '';
  }

  /* The model a property points at, directly or as the items of an array. */
  function modelOf(property) {
    return refName(property.$ref) || (property.type === 'array' && property.items ? refName(property.items.$ref) : '');
  }

  function usesModel(schema, name) {
    return !!schema && (refName(schema.$ref) === name || (!!schema.items && refName(schema.items.$ref) === name));
  }

  function usersOf(name) {
    var users = [];
    Object.keys(spec.paths).sort().forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        var operation = spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        var bodies = [operation.requestBody].concat(Object.keys(operation.responses || {}).map(function (code) {
          return operation.responses[code];
        }));
        var used = bodies.some(function (body) {
          var media = body && body.content && body.content['application/json'];
          return media && usesModel(media.schema, name);
        });
        if (used) users.push({ method: method, path: path, tag: (operation.tags && operation.tags[0]) || 'default', id: operation.operationId });
      });
    });
    return users;
  }

  function openModel(name) {
    var row = document.getElementById('emit-model-' + name);
    if (!row) return;
    row.classList.add('is-open');
    row.querySelector('.emit-model__head').setAttribute('aria-expanded', 'true');
    bringIntoView(row);
  }

  function modelRow(name, schema) {
    var row = el('article', 'emit-model');
    row.id = 'emit-model-' + name;
    var head = el('button', 'emit-model__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    head.appendChild(el('span', 'emit-model__braces', '{}'));
    head.appendChild(el('span', 'emit-model__name', name));
    head.appendChild(el('span', 'emit-model__count', plural(Object.keys(schema.properties || {}).length, 'field')));
    head.appendChild(el('span', 'emit-chip emit-chip--type', schema.type || 'object'));
    head.appendChild(el('span', 'emit-model__chevron'));
    head.addEventListener('click', function () {
      var open = row.classList.toggle('is-open');
      head.setAttribute('aria-expanded', String(open));
    });
    row.appendChild(head);

    var body = el('div', 'emit-model__body');
    body.appendChild(fieldRows(schema));
    var users = usersOf(name);
    if (users.length) {
      var used = el('div', 'emit-model__used', 'Used by');
      users.forEach(function (user) {
        var link = el('button', 'emit-model__user');
        link.type = 'button';
        link.appendChild(icon(iconFor(user.method, user.path)));
        link.appendChild(document.createTextNode(user.method.toUpperCase() + ' ' + user.path));
        link.addEventListener('click', function () { openOperation(user); });
        used.appendChild(link);
      });
      body.appendChild(used);
    }
    row.appendChild(body);
    return row;
  }

  function paintSchemas() {
    var schemas = spec && spec.components && spec.components.schemas;
    var models = document.querySelector('.swagger-ui section.models');
    if (!schemas || !models || document.getElementById('emit-schemas')) return;
    var holder = models.closest('.wrapper') || models;

    var section = el('section', 'emit-schemas');
    section.id = 'emit-schemas';
    var head = el('h3', 'emit-schemas__head', 'Schemas');
    head.appendChild(el('small', null, plural(Object.keys(schemas).length, 'model')));
    section.appendChild(head);
    Object.keys(schemas).forEach(function (name) { section.appendChild(modelRow(name, schemas[name])); });
    holder.parentNode.insertBefore(section, holder);
  }

  /* ----------------------------------------------------------- credentials
   * Authorize as the credentials Execute sends: one card per scheme, its
   * state first (held, where it came from, until when), and the way to get
   * it when it is missing. The page draws it over the window and drives
   * Swagger's own auth actions, so the store stays the one place a credential
   * lives.
   */
  function kindOf(definition) {
    var type = definition.get('type');
    if (type === 'http') return 'HTTP ' + (definition.get('scheme') || '').replace(/^\w/, function (c) { return c.toUpperCase(); });
    if (type === 'apiKey') return definition.get('name') + ' ' + definition.get('in');
    return type;
  }

  /* Filled from a response when what is held is what that response handed
     over; derived each time, like the notes, so a logout never leaves it. */
  function heldFrom(scheme, value) {
    var source = credentialSourceFor(scheme);
    var notes = source && responseNotes[source.method.toUpperCase() + ' ' + source.path];
    if (!notes || !notes.credential || notes.credential.value !== value) return null;
    var operation = spec.paths[source.path] && spec.paths[source.path][source.method];
    return operation ? operation.summary || operation.operationId : null;
  }

  function masked(value) {
    return value.length > 40 ? value.slice(0, 20) + ' ··· ' + value.slice(-15)
      : value.slice(0, 6) + ' ··· ' + value.slice(-4);
  }

  function credentialCard(scheme, scope, definition) {
    var value = heldCredential(scheme);
    var expiresAt = expiryOf(value);
    var expired = expiresAt !== null && expiresAt <= Date.now();
    var card = el('section', 'emit-auth__cred');
    var top = el('div', 'emit-auth__top');
    top.appendChild(scopeBadge(scope));
    top.appendChild(el('span', 'emit-auth__scheme', scheme));
    top.appendChild(el('span', 'emit-auth__kind', kindOf(definition) + (scope.serves ? ' · ' + scope.serves : '')));
    card.appendChild(top);

    var state = el('div', 'emit-auth__state' + (!value ? ' is-empty' : expired ? ' is-expired' : ''));
    var from = value && heldFrom(scheme, value);
    state.appendChild(document.createTextNode(!value ? 'Not held' : expired ? 'Expired' : from ? 'Held, filled from ' + from : 'Held'));
    var detail = !value ? scope.missing
      : expiresAt === null ? null
      : expired ? 'Execute would be refused'
      : 'expires in ' + Math.max(1, Math.round((expiresAt - Date.now()) / 60000)) + ' min';
    if (detail) state.appendChild(el('small', null, ' · ' + detail));
    var source = credentialSourceFor(scheme);
    if ((!value || expired) && source) {
      var link = el('button', 'emit-auth__source', (expired ? source.action + ' again' : source.action) + ' ');
      link.type = 'button';
      link.appendChild(icon('goTo'));
      link.addEventListener('click', function () { closeCredentials(); openCredentialSource(scheme); });
      state.appendChild(link);
    }
    card.appendChild(state);

    var row = el('div', 'emit-auth__row');
    var field = el('div', 'emit-auth__field');
    if (value) {
      var shown = el('span', 'emit-auth__value', masked(value));
      field.appendChild(shown);
      var eye = el('button', 'emit-auth__eye');
      eye.type = 'button';
      eye.setAttribute('aria-label', 'Show the whole ' + (source ? source.noun : 'value'));
      eye.appendChild(icon('eye'));
      eye.addEventListener('click', function () {
        var whole = shown.textContent !== value;
        shown.textContent = whole ? value : masked(value);
        eye.setAttribute('aria-pressed', String(whole));
      });
      field.appendChild(eye);
      row.appendChild(field);
      var logout = el('button', 'emit-quiet', 'Log out');
      logout.type = 'button';
      logout.addEventListener('click', function () { window.ui.authActions.logout([scheme]); });
      row.appendChild(logout);
    } else {
      var input = el('input', 'emit-auth__input');
      input.type = 'text';
      input.spellcheck = false;
      input.placeholder = 'Paste ' + (source && source.noun === 'key' ? 'an API key' : 'a ' + (source ? source.noun : 'value'));
      input.setAttribute('aria-label', scheme);
      field.appendChild(input);
      row.appendChild(field);
      var authorize = el('button', 'emit-primary', 'Authorize');
      authorize.type = 'button';
      var submit = function () { if (input.value.trim()) authorizeScheme(scheme, input.value.trim()); };
      authorize.addEventListener('click', submit);
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') submit(); });
      row.appendChild(authorize);
    }
    card.appendChild(row);
    return card;
  }

  function credentialsSignature() {
    return Object.keys(SCOPE_BY_SCHEME).map(function (scheme) {
      var value = heldCredential(scheme);
      var expiresAt = expiryOf(value);
      return (value || '') + ':' + (expiresAt === null ? '' : Math.round((expiresAt - Date.now()) / 60000));
    }).join('|');
  }

  function paintCredentials() {
    var scrim = document.getElementById('emit-auth');
    if (!scrim || scrim.hidden) return;
    var signature = credentialsSignature();
    if (scrim.dataset.signature === signature) return;
    scrim.dataset.signature = signature;
    var list = scrim.querySelector('.emit-auth__list');
    list.textContent = '';
    var definitions = window.ui.specSelectors.securityDefinitions();
    Object.keys(SCOPE_BY_SCHEME).forEach(function (scheme) {
      var definition = definitions && definitions.get(scheme);
      if (definition) list.appendChild(credentialCard(scheme, SCOPE_BY_SCHEME[scheme], definition));
    });
  }

  var credentialsOpener = null;
  var credentialsTick = null;
  function openCredentials() {
    var host = document.getElementById('emit-window');
    if (!host || !spec) return;
    var scrim = document.getElementById('emit-auth');
    if (!scrim) {
      scrim = el('div', 'emit-auth');
      scrim.id = 'emit-auth';
      var box = el('div', 'emit-auth__box');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'emit-auth-title');
      var head = el('div', 'emit-auth__head');
      var title = el('h2', null, 'Credentials');
      title.id = 'emit-auth-title';
      head.appendChild(title);
      head.appendChild(el('p', null, 'What Execute sends with each call'));
      var close = el('button', 'emit-auth__close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close');
      close.appendChild(icon('close'));
      close.addEventListener('click', closeCredentials);
      head.appendChild(close);
      box.appendChild(head);
      box.appendChild(el('div', 'emit-auth__list'));
      var foot = el('div', 'emit-auth__foot');
      var persisted = window.ui.getConfigs && window.ui.getConfigs().persistAuthorization;
      foot.appendChild(el('span', null, persisted ? 'Kept in this browser until you log out' : 'Kept on this page until it reloads'));
      var doneButton = el('button', 'emit-quiet', 'Done');
      doneButton.type = 'button';
      doneButton.addEventListener('click', closeCredentials);
      foot.appendChild(doneButton);
      box.appendChild(foot);
      scrim.appendChild(box);
      scrim.addEventListener('click', function (event) { if (event.target === scrim) closeCredentials(); });
      scrim.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeCredentials();
        /* A modal keeps Tab inside it: past the last control, back to the first. */
        if (event.key !== 'Tab') return;
        var stops = scrim.querySelectorAll('button, input');
        var first = stops[0], last = stops[stops.length - 1];
        if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
      });
      host.appendChild(scrim);
    }
    credentialsOpener = document.activeElement;
    scrim.hidden = false;
    scrim.dataset.signature = '';
    paintCredentials();
    /* The minutes to expiry count down while it is open. */
    credentialsTick = setInterval(paintCredentials, 30000);
    var first = scrim.querySelector('.emit-auth__input, .emit-auth__list button, .emit-quiet');
    if (first) first.focus();
  }

  function closeCredentials() {
    var scrim = document.getElementById('emit-auth');
    if (!scrim || scrim.hidden) return;
    scrim.hidden = true;
    clearInterval(credentialsTick);
    if (credentialsOpener && credentialsOpener.focus) credentialsOpener.focus();
  }

  /* ---------------------------------------------------------------- result
   * After Execute, one sheet says how the call went and tabs hold what came
   * back: the body, the headers, the curl. It is the page's own markup, fed
   * from Swagger's store; Swagger's live blocks stay mounted but hidden, as
   * the source of the curl and of a binary body's download link. An operation
   * with a request body then shows the request as it was sent, and Edit
   * brings the editor back.
   */
  var REASONS = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request',
    401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 415: 'Unsupported Media Type',
    429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' };
  /* The API's own headers lead: the id to quote, then the budget. */
  var OWN_HEADERS = ['x-request-id', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'retry-after'];

  /* Amber is "wait, then retry": a 429 or a server error. */
  function toneOf(status) {
    return status === 429 || status >= 500 ? 'wait' : status >= 400 ? 'bad' : 'ok';
  }

  function routeOf(block) {
    var path = block.querySelector('.opblock-summary-path');
    var method = HTTP_METHODS.filter(function (m) { return block.classList.contains('opblock-' + m); })[0];
    return path && method ? { path: path.getAttribute('data-path'), method: method } : null;
  }

  /* JSON drawn with keys, strings and numbers told apart, built as nodes so
     nothing the API returns is ever parsed as markup. */
  var JSON_TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/g;
  function highlightJson(target, text) {
    target.textContent = '';
    var last = 0;
    text.replace(JSON_TOKEN, function (match, string, colon, literal, offset) {
      if (offset > last) target.appendChild(document.createTextNode(text.slice(last, offset)));
      target.appendChild(el('span', string ? (colon ? 'k' : 's') : 'n', string || literal));
      if (colon) target.appendChild(document.createTextNode(colon));
      last = offset + match.length;
      return match;
    });
    target.appendChild(document.createTextNode(text.slice(last)));
  }

  function prettyJson(text, inline) {
    try {
      var value = JSON.parse(text);
      var spaced = JSON.stringify(value, null, 1).replace(/\n\s*/g, ' ');
      return inline && spaced.length <= 90 ? spaced : JSON.stringify(value, null, 2);
    } catch (notJson) {
      return null;
    }
  }

  function headerList(response) {
    var headers = response.get('headers');
    var list = headers && headers.toJS ? headers.toJS() : headers || {};
    var names = Object.keys(list);
    var own = OWN_HEADERS.filter(function (name) { return names.indexOf(name) !== -1; });
    return own.concat(names.filter(function (name) { return own.indexOf(name) === -1; })).map(function (name) {
      var value = list[name];
      return { name: name, value: Array.isArray(value) ? value.join(', ') : String(value) };
    });
  }

  function tool(glyph, label, action) {
    var button = el('button', 'emit-tool');
    button.type = 'button';
    if (glyph) button.appendChild(icon(glyph));
    button.appendChild(el('span', null, label));
    button.addEventListener('click', action);
    return button;
  }

  function copyTool(text) {
    var button = tool('copy', 'Copy', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text()).then(function () {
        button.lastChild.textContent = 'Copied';
        setTimeout(function () { button.lastChild.textContent = 'Copy'; }, 1200);
      });
    });
    return button;
  }

  function saveBody(block, body, type) {
    var id = block.id.replace(/^operations-[^-]+-/, '');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(body instanceof Blob ? body : new Blob([body], { type: type }));
    link.download = id + (/json/.test(type) ? '.json' : /pdf/.test(type) ? '.pdf' : '');
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function resultSheet(block, response, openTab) {
    var status = response.get('status');
    var body = response.get('text');
    var type = (headerList(response).filter(function (h) { return h.name === 'content-type'; })[0] || {}).value || '';
    var size = body instanceof Blob ? body.size : new Blob([body || '']).size;
    var requestId = (headerList(response).filter(function (h) { return h.name === 'x-request-id'; })[0] || {}).value;

    var sheet = el('div', 'emit-result');
    var head = el('div', 'emit-result__head');
    head.appendChild(el('span', 'emit-result__status emit-result__status--' + toneOf(status), status + (REASONS[status] ? ' ' + REASONS[status] : '')));
    var meta = el('span', 'emit-result__meta');
    [[response.get('duration'), 'ms'], [size, 'B']].forEach(function (pair) {
      if (pair[0] == null) return;
      var item = el('span');
      item.appendChild(el('b', null, String(pair[0])));
      item.appendChild(document.createTextNode(' ' + pair[1]));
      meta.appendChild(item);
    });
    head.appendChild(meta);
    if (requestId) {
      var rid = el('button', 'emit-result__rid');
      rid.type = 'button';
      rid.title = 'Copy the request id';
      rid.appendChild(icon('copy'));
      var shown = requestId.length > 16 ? requestId.slice(0, 8) + '…' + requestId.slice(-6) : requestId;
      var label = rid.appendChild(el('span', null, shown));
      rid.addEventListener('click', function () {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(requestId).then(function () {
          label.textContent = 'Copied';
          setTimeout(function () { label.textContent = shown; }, 1200);
        });
      });
      head.appendChild(rid);
    }

    var headers = headerList(response);
    var tabs = el('div', 'emit-tabs');
    tabs.setAttribute('role', 'tablist');
    var panels = {};
    [['body', 'Body'], ['headers', 'Headers', headers.length], ['curl', 'curl']].forEach(function (tab) {
      var button = el('button', null, tab[1]);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.dataset.tab = tab[0];
      if (tab[2]) button.appendChild(el('small', null, String(tab[2])));
      button.addEventListener('click', function () { choose(tab[0]); });
      tabs.appendChild(button);
    });
    head.appendChild(tabs);
    sheet.appendChild(head);

    var bodyPanel = el('div', 'emit-result__panel');
    var pretty = typeof body === 'string' ? prettyJson(body) : null;
    var pre = el('pre', 'emit-well');
    if (pretty) highlightJson(pre, pretty);
    else if (body instanceof Blob || !/json|text/.test(type)) pre.textContent = (type || 'binary') + ', ' + size + ' B. Save it to open it.';
    else pre.textContent = body || 'No body.';
    bodyPanel.appendChild(pre);
    var bodyTools = el('div', 'emit-result__tools');
    if (typeof body === 'string' && body) bodyTools.appendChild(copyTool(function () { return pretty || body; }));
    if (body && size) bodyTools.appendChild(tool('download', 'Save', function () { saveBody(block, body, type); }));
    bodyPanel.appendChild(bodyTools);
    panels.body = bodyPanel;

    var headersPanel = el('div', 'emit-result__panel');
    var grid = el('div', 'emit-kv');
    headers.forEach(function (header) {
      var hot = header.name === 'x-request-id' ? ' is-hot' : '';
      grid.appendChild(el('div', 'emit-kv__key' + hot, header.name));
      grid.appendChild(el('div', 'emit-kv__value' + hot, header.value));
    });
    headersPanel.appendChild(grid);
    headersPanel.appendChild(el('p', 'emit-result__explain',
      'The API’s own headers first: the id to quote, then the budget on tenant routes. The server’s standard headers follow.'));
    panels.headers = headersPanel;

    var curlPanel = el('div', 'emit-result__panel');
    var curl = block.querySelector('.curl-command pre');
    var curlText = curl ? curl.textContent : '';
    var curlPre = el('pre', 'emit-well');
    curlText.split(/('(?:[^'\\]|\\.)*')/).forEach(function (part, index) {
      curlPre.appendChild(index % 2 ? el('span', 's', part) : document.createTextNode(part));
    });
    curlPanel.appendChild(curlPre);
    var curlTools = el('div', 'emit-result__tools');
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

  function paintResults() {
    if (!window.ui || !window.ui.specSelectors) return;
    document.querySelectorAll('.opblock').forEach(function (block) {
      var route = routeOf(block);
      var response = route && block.classList.contains('is-open') && window.ui.specSelectors.responseFor(route.path, route.method);
      var sheet = block.querySelector('.emit-result');
      var wrapper = block.querySelector('.responses-wrapper');
      if (!response || !response.get || !wrapper) {
        if (sheet) sheet.remove();
        block.classList.remove('emit-has-result', 'emit-editing');
        return;
      }
      var signature = [response.get('status'), response.get('duration'), headerList(response).map(function (h) { return h.value; }).join('|')].join(':');
      if (sheet && sheet.dataset.signature === signature) return;
      var openTab = sheet && sheet.dataset.tab;
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
    var section = block.querySelector('.opblock-section-request-body');
    if (!section) return;
    var sent = section.querySelector('.emit-sent');
    if (!sent) {
      sent = el('pre', 'emit-well emit-sent');
      section.appendChild(sent);
    }
    var request = window.ui.specSelectors.mutatedRequestFor(route.path, route.method);
    var body = request && request.get('body');
    var text = typeof body === 'string' ? (prettyJson(body, true) || body) : '';
    highlightJson(sent, text);
  }

  /* ------------------------------------------------------------ body editor
   * The request body as the design draws it: numbered lines, Format and
   * Reset on its label row, the schema one tab away, and whether it is valid
   * JSON said as you type. Swagger's textarea stays the editor, so React
   * keeps the value; the page adds the gutter and the tools around it.
   */
  function requestSchemaOf(operation) {
    var media = operation && operation.requestBody && operation.requestBody.content &&
      operation.requestBody.content['application/json'];
    var ref = media && media.schema && media.schema.$ref;
    var name = ref ? ref.split('/').pop() : null;
    return name ? { name: name, schema: spec.components.schemas[name] } : null;
  }

  function setAreaValue(area, value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, value);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* What the reader has typed, against the schema the body must match. */
  function validity(text, target) {
    var value;
    try { value = JSON.parse(text); } catch (error) { return { ok: false, words: 'Not valid JSON', detail: error.message.replace(/^JSON\.parse: /, '') }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, words: 'Not an object', detail: 'the body is one JSON object' };
    var fields = Object.keys(value);
    var detail = fields.length + (fields.length === 1 ? ' field' : ' fields');
    if (!target) return { ok: true, words: 'Valid JSON', detail: detail };
    var properties = target.schema.properties || {};
    var missing = (target.schema.required || []).filter(function (name) { return !(name in value); });
    var unknown = fields.filter(function (name) { return !properties[name]; });
    if (missing.length) return { ok: false, words: 'Valid JSON', detail: detail + ' · missing ' + missing.join(', ') };
    if (unknown.length) return { ok: false, words: 'Valid JSON', detail: detail + ' · ' + target.name + ' has no ' + unknown.join(', ') };
    return { ok: true, words: 'Valid JSON', detail: detail + ' · matches ' + target.name };
  }

  function paintBodyEditors() {
    if (!spec) return;
    document.querySelectorAll('.opblock.is-open .opblock-section-request-body').forEach(function (section) {
      var block = section.closest('.opblock');
      var area = section.querySelector('textarea.body-param__text');
      var header = section.querySelector('.opblock-section-header');
      if (!area || !header) return;
      var target = requestSchemaOf(operationFor(block));

      if (!header.querySelector('.emit-body-tools')) {
        var type = el('span', 'emit-body-type', 'application/json');
        header.appendChild(type);
        var tools = el('div', 'emit-body-tools');
        var tabs = el('div', 'emit-tabs');
        ['Edit', 'Schema'].forEach(function (name) {
          var button = el('button', null, name);
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
          var pretty = prettyJson(area.value);
          if (pretty) setAreaValue(area, pretty);
        }));
        tools.appendChild(tool('reset', 'Reset to example', function () {
          var reset = block.querySelector('.try-out__btn.reset');
          if (reset) reset.click();
        }));
        tools.appendChild(tool('pencil', 'Edit', function () {
          block.classList.add('emit-editing');
          area.focus();
        })).classList.add('emit-tool--edit');
        header.appendChild(tools);
        if (target) section.appendChild(fieldRows(target.schema, 'emit-body-schema'));
      }

      var param = area.closest('.body-param');
      var gutter = param.querySelector('.emit-gutter');
      if (!gutter) {
        gutter = el('div', 'emit-gutter');
        gutter.setAttribute('aria-hidden', 'true');
        param.insertBefore(gutter, area);
        area.setAttribute('spellcheck', 'false');
        area.addEventListener('input', function () { paintBodyState(area, gutter, target); });
      }
      paintBodyState(area, gutter, target);
    });
  }

  function paintBodyState(area, gutter, target) {
    var lines = area.value.split('\n').length;
    if (gutter.dataset.lines !== String(lines)) {
      gutter.dataset.lines = String(lines);
      gutter.textContent = Array.apply(null, { length: lines }).map(function (_, i) { return i + 1; }).join('\n');
      area.style.height = 'auto';
      area.style.height = area.scrollHeight + 'px';
    }
    var param = area.closest('.body-param');
    var line = param.parentNode.querySelector('.emit-validity');
    if (!line) {
      line = el('div', 'emit-validity');
      param.parentNode.insertBefore(line, param.nextSibling);
    }
    var said = validity(area.value, target);
    var key = said.ok + said.words + said.detail;
    if (line.dataset.key === key) return;
    line.dataset.key = key;
    line.className = 'emit-validity' + (said.ok ? '' : ' is-bad');
    line.textContent = said.words + ' ';
    line.appendChild(el('span', null, '· ' + said.detail));
  }

  /* A schema's fields as rows: the name, required or not, its type and
     rules, what it means and an example. The Schemas section draws models
     the same way. */
  function fieldRows(schema, className) {
    var list = el('div', 'emit-fields' + (className ? ' ' + className : ''));
    var required = schema.required || [];
    Object.keys(schema.properties || {}).forEach(function (name) {
      var property = schema.properties[name];
      var row = el('div', 'emit-field');
      var label = el('div', 'emit-field__name', name);
      if (required.indexOf(name) !== -1) label.appendChild(el('i', null, '*'));
      row.appendChild(label);
      var about = el('div');
      var kind = el('div', 'emit-field__type');
      /* A field of another model's type names it and opens it. */
      var model = modelOf(property);
      var typed = property.$ref ? model
        : property.type === 'array' ? (model || (property.items && property.items.type) || 'item') + '[]'
        : property.type || 'object';
      var chip = kind.appendChild(el(model ? 'button' : 'span', 'emit-chip emit-chip--type', typed));
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
        var example = el('div', 'emit-field__example');
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
    var rules = [];
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
  function paintCarriedFields() {
    Object.keys(carriedIds).forEach(function (key) {
      var target = operationIndex()[key.split(' ')[0].toUpperCase() + ' ' + key.slice(key.indexOf(' ') + 1)];
      var block = target && document.getElementById('operations-' + target.tag + '-' + target.id);
      var cell = block && block.querySelector('tr[data-param-name="id"] .parameters-col_description');
      var input = cell && cell.querySelector('input');
      if (!input || !carriedFrom[key]) return;
      var chip = cell.querySelector('.emit-carried');
      if (!chip) {
        chip = el('span', 'emit-carried');
        cell.appendChild(chip);
        input.addEventListener('input', function () { chip.hidden = input.value !== carriedIds[key]; });
      }
      chip.textContent = 'from ' + carriedFrom[key];
      var path = key.slice(key.indexOf(' ') + 1);
      var value = window.ui.specSelectors.parameterValues([path, key.split(' ')[0]]).get('path.id');
      chip.hidden = value !== carriedIds[key];
    });
  }

  /* A parameter's type and format arrive as one element with the format
     nested in it, "string($uuid)"; they become two chips, "string" and "uuid". */
  function paintParameterTypes() {
    document.querySelectorAll('.parameter__type:not([data-emit-type])').forEach(function (type) {
      type.setAttribute('data-emit-type', '');
      var text = type.firstChild;
      if (text && text.nodeType === 3 && text.textContent.trim()) {
        var chip = el('span', 'emit-type', text.textContent.trim());
        type.replaceChild(chip, text);
      }
      var format = type.querySelector('.prop-format');
      if (format) format.textContent = format.textContent.replace(/^\(\$?|\)$/g, '');
    });
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

  /* A node keeps a line above its dot for the followed document's id, so
     lighting it moves nothing. The lower outcome has none: its id, when a run
     fails, takes the gap above it. */
  function lifecycleNode(step, reserve) {
    var node = el('div', 'emit-flow-node emit-flow-node--' + step.kind);
    if (reserve) node.appendChild(el('span', 'emit-flow-id', '\u00a0')).setAttribute('data-reserved', '');
    node.appendChild(el('i', 'emit-flow-dot'));
    node.appendChild(el('b', 'emit-flow-state', step.state));
    node.appendChild(el('small', 'emit-flow-caption', step.caption));
    return node;
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
      bringIntoView(block);
    })();
  }

  /* A smooth scroll aims at where the block is when it starts. Content that
     lands above it meanwhile (the lifecycle figure is drawn once the spec
     arrives) leaves it short, so where the scroll ends is checked and
     corrected. Only for a moment: after that the reader is scrolling. */
  function bringIntoView(block) {
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var pane = contentPane();
    if (!pane || !('onscrollend' in window)) return;
    var started = Date.now();
    var corrections = 0;
    pane.addEventListener('scrollend', function settle() {
      var margin = parseFloat(getComputedStyle(block).scrollMarginTop) || 0;
      var off = block.getBoundingClientRect().top - pane.getBoundingClientRect().top - margin;
      if (Date.now() - started < 4000 && Math.abs(off) > 4 && corrections++ < 2) {
        block.scrollIntoView({ block: 'start' });
        return;
      }
      pane.removeEventListener('scrollend', settle);
    });
  }

  function paintSteps() {
    var panel = document.querySelector('.information-container .info');
    if (!panel || !spec) return;

    /* The listed steps are the journey's, in order: each is marked done or
       next with the same evidence the rail uses. */
    var items = panel.querySelectorAll('ol > li');
    if (items.length === JOURNEY.length) {
      var state = journeyState();
      items.forEach(function (item, index) {
        /* Three cells: the mark, the words with their route, the proof. The
           markdown is set as HTML, so its nodes can move under a wrapper. */
        if (!item.querySelector('.emit-step-text')) {
          var words = el('span', 'emit-step-text');
          while (item.firstChild) words.appendChild(item.firstChild);
          /* The route keeps its own margin; the space before it would add to it. */
          words.querySelectorAll('code').forEach(function (code) {
            var before = code.previousSibling;
            if (before && before.nodeType === 3) before.textContent = before.textContent.replace(/\s+$/, '');
          });
          item.appendChild(el('span', 'emit-step-mark'));
          item.appendChild(words);
        }
        /* A step that has just been done marks itself with a short pulse. */
        if (state.done[index] && item.dataset.emitDone === 'false') {
          item.classList.add('emit-step--fresh');
          setTimeout(function () { item.classList.remove('emit-step--fresh'); }, 600);
        }
        item.dataset.emitDone = String(state.done[index]);
        item.classList.toggle('emit-step--done', state.done[index]);
        item.classList.toggle('emit-step--next', index === state.next);
        var proof = item.querySelector('.emit-step-proof');
        if (!proof) item.appendChild(proof = el('span', 'emit-step-proof'));
        var said = state.done[index] ? JOURNEY[index].proof : index === state.next ? 'next' : '';
        if (proof.textContent !== said) proof.textContent = said;
      });
    }

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
      chip.addEventListener('click', function () { openOperation(target); });
      chip.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openOperation(target);
      });
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
      flow.appendChild(step.via ? el('div', 'emit-flow-link', step.via) : lifecycleNode(step, true));
    });

    var outcomes = el('div', 'emit-flow-outcomes');
    LIFECYCLE.outcomes.forEach(function (step, index) {
      outcomes.appendChild(lifecycleNode(step, index < LIFECYCLE.outcomes.length - 1));
    });
    flow.appendChild(outcomes);

    section.appendChild(flow);
    anchor.parent.insertBefore(section, anchor.before);
  }

  // ------------------------------------------------------------------ shell
  /* The cockpit around Swagger: a window over a lit scene, a rail beside the
     operations and a statusbar under them. Built once, outside React's tree,
     so no re-render touches it; Swagger's own topbar and content become cells
     of the window's grid in theme.css. */
  function buildShell() {
    var root = document.getElementById('swagger-ui');
    if (!root || document.getElementById('emit-window')) return;

    var scene = el('div', 'emit-scene');
    scene.setAttribute('aria-hidden', 'true');
    ['emit-scene__glow emit-scene__glow--a', 'emit-scene__glow emit-scene__glow--b',
     'emit-scene__streak', 'emit-scene__streak emit-scene__streak--thin'].forEach(function (cls) {
      scene.appendChild(el('i', cls));
    });
    scene.insertAdjacentHTML('beforeend', '<svg class="emit-scene__grain"><filter id="emit-grain">'
      + '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/></filter>'
      + '<rect width="100%" height="100%" filter="url(#emit-grain)"/></svg>');
    document.body.insertBefore(scene, document.body.firstChild);

    var win = el('div');
    win.id = 'emit-window';
    root.parentNode.insertBefore(win, root);

    var rail = el('aside');
    rail.id = 'emit-rail';
    rail.setAttribute('aria-label', 'Operations and progress');
    var journey = el('section', 'emit-journey');
    journey.id = 'emit-journey';
    journey.hidden = true;
    rail.appendChild(journey);

    var map = el('nav', 'emit-map');
    map.id = 'emit-map';
    map.setAttribute('aria-label', 'Operations');
    rail.appendChild(map);

    var live = el('section', 'emit-live');
    live.id = 'emit-live';
    live.hidden = true;
    live.setAttribute('role', 'status');
    rail.appendChild(live);

    var status = el('footer');
    status.id = 'emit-statusbar';
    var server = el('span', 'emit-status__server');
    server.id = 'emit-status-server';
    status.appendChild(server);
    var run = el('span', 'emit-status__run');
    run.id = 'emit-status-run';
    run.hidden = true;
    status.appendChild(run);
    status.appendChild(el('span', 'emit-status__grow'));

    var budget = el('span', 'emit-status__budget');
    budget.id = 'emit-status-budget';
    budget.hidden = true;
    status.appendChild(budget);

    var last = el('button', 'emit-status__last');
    last.id = 'emit-status-last';
    last.type = 'button';
    last.hidden = true;
    last.title = 'Go to the operation that answered';
    last.addEventListener('click', function () {
      var target = latestAnswer && operationIndex()[latestAnswer.key];
      if (target) openOperation(target);
    });
    status.appendChild(last);

    var requestId = el('button', 'emit-status__request');
    requestId.id = 'emit-status-request';
    requestId.type = 'button';
    requestId.hidden = true;
    requestId.title = 'Copy the request id';
    requestId.addEventListener('click', function () {
      var value = requestId.dataset.value;
      if (!value || !navigator.clipboard) return;
      navigator.clipboard.writeText(value).then(function () {
        requestId.dataset.copied = 'true';
        requestId.textContent = 'Request id copied';
        setTimeout(function () { delete requestId.dataset.copied; paintStatusTelemetry(); }, 1400);
      });
    });
    status.appendChild(requestId);
    var legend = document.getElementById('emit-legend');
    if (legend) status.appendChild(legend);

    win.appendChild(rail);
    win.appendChild(root);
    win.appendChild(status);
  }

  /* Tags and operations in the order Swagger shows them: tags and paths
     alphabetical, methods in their HTTP order. */
  function mapEntries() {
    var byTag = {};
    Object.keys(spec.paths).sort().forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        var operation = spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        var tag = (operation.tags && operation.tags[0]) || 'default';
        (byTag[tag] = byTag[tag] || []).push({ tag: tag, id: operation.operationId, method: method, path: path,
          name: operation.summary || operation.operationId });
      });
    });
    return Object.keys(byTag).sort().map(function (tag) { return { tag: tag, operations: byTag[tag] }; });
  }

  function paintMap() {
    var map = document.getElementById('emit-map');
    if (!map || !spec || map.dataset.built) return;
    map.dataset.built = 'true';

    var overview = el('a', 'emit-map__item emit-map__item--overview');
    overview.href = '#';
    overview.dataset.target = 'overview';
    overview.appendChild(icon('home'));
    overview.appendChild(el('span', 'emit-map__name', 'Overview'));
    overview.addEventListener('click', function (event) {
      event.preventDefault();
      var info = document.querySelector('.information-container');
      if (info) info.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    map.appendChild(overview);

    mapEntries().forEach(function (group) {
      map.appendChild(el('div', 'emit-map__tag', group.tag));
      group.operations.forEach(function (operation) {
        var link = el('a', 'emit-map__item');
        link.href = '#/' + encodeURIComponent(operation.tag) + '/' + operation.id;
        link.dataset.target = 'operations-' + operation.tag + '-' + operation.id;
        link.title = operation.method.toUpperCase() + ' ' + operation.path;
        link.appendChild(icon(iconFor(operation.method, operation.path)));
        link.appendChild(el('span', 'emit-map__name', operation.name));
        var scopes = scopesFor(operation.method, operation.path) || [];
        if (scopes[0] && scopes[0].icon) {
          var mark = icon(scopes[0].icon);
          mark.setAttribute('class', 'emit-map__scope emit-map__scope--' + scopes[0].key);
          link.appendChild(mark);
        }
        link.addEventListener('click', function (event) {
          event.preventDefault();
          openOperation({ tag: operation.tag, id: operation.id });
        });
        map.appendChild(link);
      });
    });

    var schemas = spec.components && spec.components.schemas;
    if (schemas && Object.keys(schemas).length) {
      map.appendChild(el('div', 'emit-map__tag', 'Reference'));
      var models = el('a', 'emit-map__item');
      models.href = '#';
      models.dataset.target = 'emit-schemas';
      models.appendChild(icon('braces'));
      models.appendChild(el('span', 'emit-map__name', 'Schemas'));
      models.appendChild(el('span', 'emit-map__count', String(Object.keys(schemas).length)));
      models.addEventListener('click', function (event) {
        event.preventDefault();
        var section = document.getElementById('emit-schemas');
        if (section) bringIntoView(section);
      });
      map.appendChild(models);
    }
    spyScroll();
  }

  /* Where the reader is: the last section whose top has passed under the
     sticky operation header. */
  function contentPane() {
    return document.querySelector('#emit-window .swagger-container > .swagger-ui');
  }

  function spyScroll() {
    var pane = contentPane();
    var map = document.getElementById('emit-map');
    if (!pane || !map) return;
    var line = pane.getBoundingClientRect().top + 64;
    var current = 'overview';
    document.querySelectorAll('.opblock').forEach(function (block) {
      if (block.getBoundingClientRect().top <= line) current = block.id;
    });
    /* The section starts where its heading's space does, above the heading. */
    var heading = document.querySelector('.emit-schemas__head');
    if (heading && heading.getBoundingClientRect().top - parseFloat(getComputedStyle(heading).marginTop) <= line) current = 'emit-schemas';
    map.querySelectorAll('.emit-map__item').forEach(function (link) {
      link.classList.toggle('is-current', link.dataset.target === current);
    });
    paintCrumb(current);
  }

  function paintCrumb(current) {
    var crumb = document.getElementById('emit-crumb');
    if (!crumb) return;
    var block = current === 'overview' ? null : document.getElementById(current);
    var key = block ? current : 'overview';
    if (crumb.dataset.key === key) return;
    crumb.dataset.key = key;
    crumb.textContent = '';
    if (!block || key === 'emit-schemas') {
      crumb.appendChild(el('b', null, block ? 'Schemas' : 'Overview'));
      return;
    }
    var method = block.querySelector('.opblock-summary-method');
    var path = block.querySelector('.opblock-summary-path');
    var tag = block.closest('.opblock-tag-section');
    var tagName = tag && tag.querySelector('h3.opblock-tag');
    crumb.appendChild(el('i', null, tagName ? tagName.getAttribute('data-tag') : ''));
    crumb.appendChild(el('i', null, '/'));
    crumb.appendChild(el('b', null, (method ? method.textContent.trim() : '') + ' ' + (path ? path.getAttribute('data-path') : '')));
  }

  function paintStatusbar() {
    var server = document.getElementById('emit-status-server');
    if (!server || !spec || server.dataset.built) return;
    var first = spec.servers && spec.servers[0];
    if (!first) return;
    server.dataset.built = 'true';
    server.appendChild(el('i', 'emit-status__led'));
    server.appendChild(document.createTextNode(first.url.replace(/^https?:\/\//, '')
      + (first.description ? ' · ' + first.description : '')));
  }

  function currentFollow() {
    var follow = null;
    Object.keys(responseNotes).forEach(function (key) {
      if (responseNotes[key] && responseNotes[key].follow) follow = responseNotes[key].follow;
    });
    return follow;
  }

  function stepDone(step) {
    if (step.done.held) return !!(window.ui && window.ui.authSelectors && heldCredential(step.done.held));
    if (step.done.run) {
      var follow = currentFollow();
      return !!follow && follow.state === step.done.run;
    }
    var answer = lastAnswers[step.method.toUpperCase() + ' ' + step.path];
    return !!answer && answer.status >= 200 && answer.status < 300;
  }

  function journeyState() {
    var done = JOURNEY.map(stepDone);
    return { done: done, next: done.indexOf(false) };
  }

  /* The rail's compact walkthrough: progress and the one step that is next. */
  function paintJourney() {
    var journey = document.getElementById('emit-journey');
    if (!journey || !spec) return;
    if (!journey.firstChild) {
      var label = el('div', 'emit-rail__label', 'Getting started');
      label.appendChild(el('small', 'emit-journey__count'));
      journey.appendChild(label);
      var bar = el('div', 'emit-journey__bar');
      JOURNEY.forEach(function () { bar.appendChild(el('i')); });
      journey.appendChild(bar);
      var next = el('button', 'emit-journey__next');
      next.type = 'button';
      var words = el('span', 'emit-journey__words');
      words.appendChild(el('small', null, 'Next'));
      words.appendChild(el('span', 'emit-journey__step'));
      next.appendChild(words);
      next.appendChild(icon('goTo'));
      next.addEventListener('click', function () {
        var step = JOURNEY[journeyState().next];
        var target = step && operationIndex()[step.method.toUpperCase() + ' ' + step.path];
        if (target) openOperation(target);
      });
      journey.appendChild(next);
      journey.hidden = false;
    }
    var state = journeyState();
    var count = state.done.filter(Boolean).length;
    var key = state.done.join() + state.next;
    if (journey.dataset.key === key) return;
    journey.dataset.key = key;
    journey.querySelector('.emit-journey__count').textContent = count + ' / ' + JOURNEY.length;
    journey.querySelectorAll('.emit-journey__bar i').forEach(function (segment, index) {
      segment.className = state.done[index] ? 'is-done' : index === state.next ? 'is-next' : '';
    });
    var nextButton = journey.querySelector('.emit-journey__next');
    nextButton.hidden = state.next < 0;
    if (state.next >= 0) journey.querySelector('.emit-journey__step').textContent = JOURNEY[state.next].label;
  }

  /* The followed document, where the reader is: its stage, how long it has
     run, and the download once the PDF is ready. Absent when nothing runs. */
  var liveTicker = null;

  function paintLive() {
    var live = document.getElementById('emit-live');
    if (!live) return;
    var follow = currentFollow();
    live.hidden = !follow;
    var run = document.getElementById('emit-status-run');
    if (run) run.hidden = !follow;
    if (!follow) return;

    var ended = follow.phase === 'ended';
    var seconds = ((follow.endedAt || Date.now()) - follow.startedAt) / 1000;
    var stages = [LIFECYCLE.run[0].state, LIFECYCLE.run[2].state, isTerminal(follow.state) ? follow.state : LIFECYCLE.outcomes[0].state];
    var at = stages.indexOf(follow.state);

    var key = follow.id + follow.state + follow.phase;
    if (live.dataset.key !== key) {
      live.dataset.key = key;
      live.textContent = '';
      var head = el('div', 'emit-live__head');
      head.appendChild(el('i', 'emit-live__dot' + (ended ? '' : ' is-running')));
      head.appendChild(document.createTextNode('Document ' + follow.id.slice(0, 8)));
      head.appendChild(el('small', 'emit-live__elapsed'));
      live.appendChild(head);

      var track = el('div', 'emit-live__track');
      stages.forEach(function (state, index) {
        var stage = el('div', 'emit-live__stage');
        if (index < at) stage.classList.add('is-past');
        if (index === at) stage.classList.add(state === 'DONE' ? 'is-good' : state === 'FAILED' ? 'is-bad' : 'is-current');
        stage.appendChild(el('i'));
        stage.appendChild(el('b', null, state));
        track.appendChild(stage);
      });
      live.appendChild(track);

      var foot = el('div', 'emit-live__foot');
      var said = { following: follow.state === 'PENDING' ? 'Queued in Kafka' : 'Rendering the PDF',
                   ended: follow.state === 'DONE' ? 'PDF ready' : 'Generation failed',
                   paused: 'Still ' + follow.state + ', paused',
                   'rate-limited': 'Waiting for the rate limit',
                   'saving-budget': 'Paused to save your requests',
                   error: 'Reading it back failed',
                   'no-credential': 'No key to read it back with' }[follow.phase] || '';
      foot.appendChild(el('span', null, said));
      if (ended && follow.state === 'DONE' && followOperation('result')) {
        var download = el('button', 'emit-live__action', 'Download PDF');
        download.type = 'button';
        download.addEventListener('click', function () { openFollowed('result', follow.id); });
        foot.appendChild(download);
      }
      live.appendChild(foot);

      if (run) {
        run.textContent = '';
        run.appendChild(el('i', 'emit-live__dot' + (ended ? '' : ' is-running')));
        run.appendChild(document.createTextNode('Document ' + follow.id.slice(0, 8) + ' · ' + follow.state));
      }
    }
    live.querySelector('.emit-live__elapsed').textContent = seconds.toFixed(1) + 's';

    if (!ended && !liveTicker) liveTicker = setInterval(schedule, 200);
    if (ended && liveTicker) {
      clearInterval(liveTicker);
      liveTicker = null;
    }
  }

  /* Telemetry of the latest answer: the tenant's budget, the status and time,
     the request id to quote. */
  function paintStatusTelemetry() {
    var answer = latestAnswer;
    var budget = document.getElementById('emit-status-budget');
    var last = document.getElementById('emit-status-last');
    var request = document.getElementById('emit-status-request');
    if (!answer || !budget) return;

    budget.hidden = !latestBudget;
    if (latestBudget) {
      budget.textContent = 'RateLimit ' + latestBudget.remaining + ' / ' + latestBudget.limit;
      var meter = el('span', 'emit-status__meter');
      var fill = el('i');
      fill.style.width = Math.round(100 * latestBudget.remaining / Math.max(1, latestBudget.limit)) + '%';
      meter.appendChild(fill);
      budget.appendChild(meter);
    }
    last.hidden = false;
    last.textContent = 'Last ' + answer.status + (typeof answer.duration === 'number' ? ' · ' + answer.duration + ' ms' : '');
    last.className = 'emit-status__last ' + (answer.status < 400 ? 'is-ok' : 'is-bad');
    if (request.dataset.copied) return;
    request.hidden = !latestRequestId;
    if (latestRequestId) {
      request.dataset.value = latestRequestId;
      request.textContent = 'X-Request-Id ' + latestRequestId.slice(0, 4) + '…' + latestRequestId.slice(-2);
    }
  }

  /* What the page remembers: the last answer on each operation's row and a
     dot beside it in the map. */
  function paintLastAnswers() {
    var index = operationIndex();
    Object.keys(lastAnswers).forEach(function (key) {
      var answer = lastAnswers[key];
      var target = index[key];
      if (!target) return;
      var tone = answer.status < 400 ? 'is-ok' : 'is-bad';
      var text = String(answer.status);
      var took = typeof answer.duration === 'number' ? answer.duration + ' ms' : '';

      var block = document.getElementById('operations-' + target.tag + '-' + target.id);
      var summary = block && block.querySelector('.opblock-summary');
      if (summary) {
        var mark = summary.querySelector('.emit-last');
        if (!mark) {
          mark = el('span', 'emit-last');
          var scopes = summary.querySelector('.emit-scopes');
          summary.insertBefore(mark, scopes || null);
        }
        var markKey = text + took;
        if (mark.dataset.key !== markKey) {
          mark.dataset.key = markKey;
          mark.className = 'emit-last ' + tone;
          mark.textContent = text;
          if (took) mark.appendChild(el('span', 'emit-last__time', took));
        }
      }

      var link = document.querySelector('.emit-map__item[data-target="operations-' + target.tag + '-' + target.id + '"]');
      if (link) {
        var dot = link.querySelector('.emit-map__ran');
        if (!dot) {
          dot = el('i', 'emit-map__ran');
          link.insertBefore(dot, link.querySelector('.emit-map__scope'));
        }
        dot.className = 'emit-map__ran ' + tone;
      }
    });
  }

  /* Ctrl+B folds the rail, as in an editor, and the choice is remembered. */
  var RAIL_KEY = 'emit.rail';

  function toggleRail() {
    var win = document.getElementById('emit-window');
    if (!win) return;
    var folded = win.dataset.rail !== 'closed';
    win.dataset.rail = folded ? 'closed' : 'open';
    try { localStorage.setItem(RAIL_KEY, win.dataset.rail); } catch (ignored) { /* private mode */ }
  }

  function restoreRail() {
    var win = document.getElementById('emit-window');
    var saved = null;
    try { saved = localStorage.getItem(RAIL_KEY); } catch (ignored) { /* private mode */ }
    if (win) win.dataset.rail = saved === 'closed' ? 'closed' : 'open';
  }

  /* Ctrl+K: type part of a name or path, Enter lands on the operation. */
  var palette = null;

  function openPalette() {
    if (!spec) return;
    if (!palette) palette = buildPalette();
    palette.back.hidden = false;
    palette.input.value = '';
    palette.selected = 0;
    renderPalette();
    palette.input.focus();
  }

  function closePalette() {
    if (palette) palette.back.hidden = true;
  }

  function buildPalette() {
    var back = el('div', 'emit-palette');
    back.hidden = true;
    var box = el('div', 'emit-palette__box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Jump to an operation');
    var input = el('input', 'emit-palette__input');
    input.placeholder = 'Jump to an operation…';
    input.setAttribute('aria-label', 'Operation name or path');
    input.autocomplete = 'off';
    var list = el('ul', 'emit-palette__list');
    list.setAttribute('role', 'listbox');
    var foot = el('div', 'emit-palette__foot');
    ['↑↓ choose', 'Enter open', 'Esc close'].forEach(function (hint) { foot.appendChild(el('span', null, hint)); });
    box.appendChild(input);
    box.appendChild(list);
    box.appendChild(foot);
    back.appendChild(box);
    document.body.appendChild(back);

    var entries = [];
    mapEntries().forEach(function (group) { entries = entries.concat(group.operations); });
    var state = { back: back, input: input, list: list, entries: entries, shown: entries, selected: 0 };

    back.addEventListener('click', function (event) { if (event.target === back) closePalette(); });
    input.addEventListener('input', function () { state.selected = 0; renderPalette(); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { state.selected = Math.min(state.selected + 1, state.shown.length - 1); renderPalette(); event.preventDefault(); }
      if (event.key === 'ArrowUp') { state.selected = Math.max(state.selected - 1, 0); renderPalette(); event.preventDefault(); }
      if (event.key === 'Enter' && state.shown[state.selected]) choose(state.shown[state.selected]);
      if (event.key === 'Escape') closePalette();
    });
    list.addEventListener('click', function (event) {
      var item = event.target.closest('li');
      if (item) choose(state.shown[Number(item.dataset.index)]);
    });
    return state;
  }

  function choose(operation) {
    closePalette();
    openOperation({ tag: operation.tag, id: operation.id });
  }

  function renderPalette() {
    var query = palette.input.value.trim().toLowerCase();
    palette.shown = palette.entries.filter(function (entry) {
      return (entry.name + ' ' + entry.method + ' ' + entry.path).toLowerCase().indexOf(query) !== -1;
    });
    palette.selected = Math.min(palette.selected, Math.max(0, palette.shown.length - 1));
    palette.list.textContent = '';
    palette.shown.forEach(function (entry, index) {
      var item = el('li', 'emit-palette__item');
      item.dataset.index = String(index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === palette.selected));
      item.appendChild(icon(iconFor(entry.method, entry.path)));
      item.appendChild(el('span', 'emit-palette__name', entry.name));
      item.appendChild(el('span', 'emit-palette__path', entry.method.toUpperCase() + ' ' + entry.path));
      palette.list.appendChild(item);
    });
    var current = palette.list.children[palette.selected];
    if (current) current.scrollIntoView({ block: 'nearest' });
  }

  function bindShortcuts() {
    document.addEventListener('keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      var key = event.key.toLowerCase();
      if (key === 'k') { event.preventDefault(); openPalette(); }
      if (key === 'b' && document.getElementById('emit-window')) { event.preventDefault(); toggleRail(); }
    });
  }

  // -------------------------------------------------------------- scheduler

  function paint() {
    watchStore();
    paintTopbar();
    paintResults();
    paintBodyEditors();
    paintCredentials();
    paintResponseNotes();
    paintLifecycleCurrent();
    paintTitle();
    paintResponseRows();
    paintOperations();
    paintParameterTypes();
    paintCarriedFields();
    paintResponseIndex();
    paintGroupCounts();
    paintAuthMatrix();
    paintSchemas();
    paintSteps();
    paintExampleBoxes();
    paintLifecycle();
    paintScrollers();
    paintMap();
    paintStatusbar();
    paintJourney();
    paintLive();
    paintStatusTelemetry();
    paintLastAnswers();
    spyScroll();
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
    buildShell();
    restoreRail();
    paint();
    bindLegend();
    bindShortcuts();

    /* The content pane scrolls, not the page. Capture, because the pane is
       created by React after this runs. */
    document.addEventListener('scroll', function (event) {
      if (event.target === contentPane()) spyScroll();
    }, true);

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
