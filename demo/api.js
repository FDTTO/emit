/*
 * The EMIT API answered inside the page, for the static demo.
 *
 * Loaded before Swagger UI, it takes over fetch for the API, the spec and
 * the health check; anything else goes to the network. The rules are the
 * API's own: who may call what, the rolling rate limit, a document's states
 * and stamps. The facts it replays (the rate limit, the timings and the PDF
 * of real runs) were recorded from the running app by demo/export.py, and
 * the demo check proves its answers to demo/cases.json match the app's.
 * State lives in this browser only.
 */
(function () {
  'use strict';

  var ROOT = new URL('..', document.currentScript.src).href;
  var STATE_KEY = 'emit.demo.state';
  var ADMIN = { username: 'admin', password: 'admin123' };
  var TOKEN_TTL_S = 86400;
  var WINDOW_MS = 60000;
  var SCHEMA_RULE = /^[a-z][a-z0-9_]{1,62}$/;
  var UUID_RULE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /* Marks a token this page issued; the demo verifies nothing a server would. */
  var SIGNATURE = 'ZW1pdC1kZW1v';
  var WRONG_CREDENTIAL = 'This credential cannot access this route. '
    + 'Tenant management needs an admin token; documents need a tenant API key.';

  var networkFetch = window.fetch.bind(window);
  var facts = networkFetch(ROOT + 'demo/facts.json').then(function (response) { return response.json(); });
  var hits = {};
  var state = load();

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STATE_KEY));
      if (saved && Array.isArray(saved.tenants) && Array.isArray(saved.documents)) return saved;
    } catch (unavailable) { /* a private window: the demo starts empty */ }
    return { tenants: [], documents: [] };
  }

  function save() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (unavailable) { /* kept in memory */ }
  }

  // ------------------------------------------------------------- answers
  function iso(ms) { return new Date(ms).toISOString(); }

  function answer(status, body, headers) {
    var all = Object.assign({ 'X-Request-Id': crypto.randomUUID() }, headers || {});
    if (body !== null && body !== undefined && !(body instanceof ArrayBuffer)) {
      all['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    return new Response(body === undefined ? null : body, { status: status, headers: all });
  }

  function refuse(status, message, headers) {
    return answer(status, { status: status, message: message, timestamp: iso(Date.now()) }, headers);
  }

  /* Field errors sorted and joined, as the API's validation handler writes them. */
  function invalid(errors) {
    return errors.length ? refuse(400, errors.sort().join(', ')) : null;
  }

  function required(errors, body, field) {
    var value = body[field];
    if (typeof value !== 'string' || !value.trim()) errors.push(field + ': must not be blank');
    return typeof value === 'string' ? value : null;
  }

  function longest(errors, value, field, max) {
    if (value !== null && value.length > max) errors.push(field + ': ' + field + ' must not exceed ' + max + ' characters');
  }

  // ---------------------------------------------------------- credentials
  function base64url(text) {
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function issueToken() {
    var now = Math.floor(Date.now() / 1000);
    return base64url(JSON.stringify({ alg: 'HS256' })) + '.'
      + base64url(JSON.stringify({ sub: ADMIN.username, iat: now, exp: now + TOKEN_TTL_S })) + '.' + SIGNATURE;
  }

  function tokenValid(token) {
    var parts = token.split('.');
    if (parts.length !== 3 || parts[2] !== SIGNATURE) return false;
    try {
      var claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return claims.exp * 1000 > Date.now();
    } catch (malformed) {
      return false;
    }
  }

  /* The order the API checks in: a credential at all, then whether it is
     valid, then whether it opens this route, then whether its tenant is
     active. Answers with the refusal, or with who is calling. */
  function caller(headers, route) {
    var bearer = /^Bearer (.+)$/.exec(headers.get('Authorization') || '');
    var key = headers.get('X-API-Key');
    if (!bearer && !key) return { refusal: refuse(401, 'Authentication required.') };
    if (bearer && !tokenValid(bearer[1])) return { refusal: refuse(401, 'Invalid or expired token.') };
    var tenant = bearer ? null : state.tenants.filter(function (t) { return t.apiKey === key; })[0];
    if (!bearer && !tenant) return { refusal: refuse(401, 'Invalid API key.') };
    if ((route === 'admin') !== !!bearer) return { refusal: refuse(403, WRONG_CREDENTIAL) };
    if (tenant && !tenant.active) return { refusal: refuse(403, 'Tenant is inactive.') };
    return { tenant: tenant };
  }

  /* A rolling minute per tenant, counted before the route answers. */
  function budget(tenant, limit) {
    var now = Date.now();
    var times = (hits[tenant.id] || []).filter(function (t) { return now - t < WINDOW_MS; });
    hits[tenant.id] = times;
    var reset = function () { return times.length ? Math.ceil((times[0] + WINDOW_MS - now) / 1000) : 0; };
    if (times.length >= limit) {
      var wait = reset();
      return { refusal: refuse(429, 'Rate limit exceeded. Try again in ' + wait + ' seconds.',
        { 'RateLimit-Limit': limit, 'RateLimit-Remaining': 0, 'RateLimit-Reset': wait, 'Retry-After': wait }) };
    }
    times.push(now);
    return { headers: { 'RateLimit-Limit': String(limit), 'RateLimit-Remaining': String(limit - times.length),
                        'RateLimit-Reset': String(reset()) } };
  }

  // -------------------------------------------------------------- tenants
  function tenantView(tenant) {
    return { id: tenant.id, name: tenant.name, schemaName: tenant.schemaName, active: tenant.active, createdAt: tenant.createdAt };
  }

  function findTenant(id) {
    if (!UUID_RULE.test(id)) return { refusal: refuse(400, "'id' is not a valid UUID.") };
    var tenant = state.tenants.filter(function (t) { return t.id === id; })[0];
    return tenant ? { tenant: tenant } : { refusal: refuse(404, 'Tenant not found: ' + id) };
  }

  function createTenant(body) {
    var errors = [];
    var name = required(errors, body, 'name');
    longest(errors, name, 'name', 100);
    var schemaName = required(errors, body, 'schemaName');
    if (schemaName !== null && !SCHEMA_RULE.test(schemaName)) {
      errors.push('schemaName: schemaName must start with a lowercase letter and contain only lowercase letters, '
        + 'digits, and underscores, between 2 and 63 characters');
    }
    var refusal = invalid(errors);
    if (refusal) return refusal;
    var taken = state.tenants.some(function (t) { return t.schemaName === schemaName || t.name === name; });
    if (taken) return refuse(409, 'Record already exists with the given data.');
    var bytes = crypto.getRandomValues(new Uint8Array(32));
    var tenant = { id: crypto.randomUUID(), name: name, schemaName: schemaName, active: true, createdAt: iso(Date.now()),
                   apiKey: Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') };
    state.tenants.push(tenant);
    save();
    return answer(201, Object.assign(tenantView(tenant), { apiKey: tenant.apiKey }));
  }

  function tenants(method, rest, body) {
    if (!rest && method === 'GET') return answer(200, state.tenants.map(tenantView));
    if (!rest && method === 'POST') return createTenant(body);
    var parts = rest.split('/');
    var found = findTenant(parts[0]);
    if (found.refusal) return found.refusal;
    if (parts.length === 1 && method === 'GET') return answer(200, tenantView(found.tenant));
    if (parts[1] === 'deactivate' || parts[1] === 'reactivate') {
      found.tenant.active = parts[1] === 'reactivate';
      save();
      return answer(204, null);
    }
    return refuse(404, 'Not found.');
  }

  // ------------------------------------------------------------ documents
  /* What the document is now, from when generation was requested: queued
     for the time a real run queued, then rendering for the time it
     rendered. Derived, never scheduled, so a reload mid-run stays true. */
  function documentView(document, f) {
    var view = { id: document.id, title: document.title, content: document.content, status: 'PENDING',
                 createdAt: document.createdAt, queuedAt: null, startedAt: null, finishedAt: null,
                 updatedAt: document.createdAt };
    if (!document.requestedAt) return view;
    var requested = Date.parse(document.requestedAt);
    var started = requested + f.queuedMs;
    var finished = started + f.renderingMs;
    var now = Date.now();
    if (now < started) return view;
    view.status = now < finished ? 'PROCESSING' : 'DONE';
    view.queuedAt = document.requestedAt;
    view.startedAt = iso(started);
    view.finishedAt = view.status === 'DONE' ? iso(finished) : null;
    view.updatedAt = view.finishedAt || view.startedAt;
    return view;
  }

  function createDocument(tenant, body, f) {
    var errors = [];
    longest(errors, required(errors, body, 'title'), 'title', 255);
    longest(errors, required(errors, body, 'content'), 'content', 50000);
    var refusal = invalid(errors);
    if (refusal) return refusal;
    var document = { id: crypto.randomUUID(), tenantId: tenant.id, title: body.title, content: body.content,
                     createdAt: iso(Date.now()), requestedAt: null };
    state.documents.push(document);
    save();
    return answer(201, documentView(document, f));
  }

  function listDocuments(tenant, query, f) {
    var page = Math.max(0, parseInt(query.get('page'), 10) || 0);
    var size = Math.max(1, parseInt(query.get('size'), 10) || 20);
    var own = state.documents.filter(function (d) { return d.tenantId === tenant.id; }).reverse();
    var content = own.slice(page * size, page * size + size).map(function (d) {
      var view = documentView(d, f);
      return { id: view.id, title: view.title, status: view.status, createdAt: view.createdAt };
    });
    var totalPages = Math.ceil(own.length / size);
    return { page: page, content: content, size: size, totalElements: own.length, totalPages: totalPages,
             first: page === 0, last: page >= totalPages - 1 };
  }

  function documents(method, rest, tenant, query, body, f) {
    if (!rest && method === 'GET') return answer(200, listDocuments(tenant, query, f));
    if (!rest && method === 'POST') return createDocument(tenant, body, f);
    var parts = rest.split('/');
    if (!UUID_RULE.test(parts[0])) return refuse(400, "'id' is not a valid UUID.");
    var document = state.documents.filter(function (d) { return d.id === parts[0] && d.tenantId === tenant.id; })[0];
    if (!document) return refuse(404, 'Document not found: ' + parts[0]);
    var view = documentView(document, f);
    if (parts.length === 1 && method === 'GET') return answer(200, view);
    if (parts[1] === 'generate' && method === 'POST') {
      if (view.status !== 'PENDING') return refuse(409, 'Document must be PENDING but is ' + view.status + ': ' + document.id);
      /* A second request while PENDING is accepted; the first one is what runs. */
      document.requestedAt = document.requestedAt || iso(Date.now());
      save();
      return answer(202, null);
    }
    if (parts[1] === 'pdf' && method === 'GET') {
      if (view.status !== 'DONE') return refuse(409, 'PDF not yet available for document: ' + document.id);
      return networkFetch(ROOT + 'demo/sample.pdf').then(function (response) { return response.arrayBuffer(); })
        .then(function (bytes) {
          return answer(200, bytes, { 'Content-Type': 'application/pdf',
                                      'Content-Disposition': 'attachment; filename="document-' + document.id + '.pdf"' });
        });
    }
    return refuse(404, 'Not found.');
  }

  // -------------------------------------------------------------- routing
  function login(body) {
    var errors = [];
    var username = required(errors, body, 'username');
    var password = required(errors, body, 'password');
    var refusal = invalid(errors);
    if (refusal) return refusal;
    if (username !== ADMIN.username || password !== ADMIN.password) return refuse(401, 'Invalid username or password.');
    return answer(200, { token: issueToken() });
  }

  function route(method, path, query, headers, body, f) {
    if (path === '/v3/api-docs/swagger-config') return networkFetch(ROOT + 'v3/swagger-config.json');
    if (path === '/v3/api-docs') return networkFetch(ROOT + 'v3/api-docs.json');
    if (path === '/actuator/health') return answer(200, { status: 'UP' });
    if (path === '/v1/auth/login' && method === 'POST') return login(body);

    var match = /^\/v1\/(tenants|documents)(?:\/(.*))?$/.exec(path);
    if (!match) return refuse(404, 'Not found.');
    var who = caller(headers, match[1] === 'tenants' ? 'admin' : 'tenant');
    if (who.refusal) return who.refusal;
    if (match[1] === 'tenants') return tenants(method, match[2] || '', body);

    var spent = budget(who.tenant, f.rateLimit);
    if (spent.refusal) return spent.refusal;
    return Promise.resolve(documents(method, match[2] || '', who.tenant, query, body, f)).then(function (response) {
      Object.keys(spent.headers).forEach(function (name) { response.headers.set(name, spent.headers[name]); });
      return response;
    });
  }

  /* The API's own paths, wherever the page or the spec's server puts them. */
  function apiPath(url) {
    var match = /\/(v1\/.+|v3\/api-docs(?:\/swagger-config)?|actuator\/health)$/.exec(url.pathname);
    return match ? '/' + match[1] : null;
  }

  window.fetch = function (input, init) {
    var request = new Request(input, init);
    var url = new URL(request.url, location.href);
    var path = apiPath(url);
    if (!path) return networkFetch(input, init);
    return Promise.all([facts, request.text()]).then(function (ready) {
      var body = {};
      try { body = ready[1] ? JSON.parse(ready[1]) : {}; } catch (notJson) { body = {}; }
      return route(request.method, path, url.searchParams, request.headers, body || {}, ready[0]);
    });
  };

  // ------------------------------------------------------------ the mark
  /* Says, in the statusbar, that no server is answering. */
  function markDemo() {
    var bar = document.getElementById('emit-statusbar');
    if (!bar) return false;
    var mark = document.createElement('span');
    mark.className = 'emit-status__demo';
    mark.textContent = 'Demo · answered in this page';
    mark.title = 'No server behind this page: it answers as the EMIT API does, with the timings and the PDF '
      + 'of a real run. The README shows how to run the real one.';
    bar.insertBefore(mark, bar.querySelector('.emit-status__grow'));
    return true;
  }

  new MutationObserver(function (changes, observer) {
    if (markDemo()) observer.disconnect();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
