/* In-page helpers for verification scenarios. Loaded by verify.py ahead of
 * the scenario, after verify-harness.html's own scripts.
 *
 * A scenario records findings with L(key, value); verify.py reads them back
 * from window.__log. Console errors and uncaught errors are collected into
 * __log.errors on their own, so "no errors" is always part of the result
 * rather than something a scenario has to remember to check.
 */
(function () {
  'use strict';
  try { localStorage.clear(); sessionStorage.clear(); } catch (ignored) { /* private mode */ }

  var log = window.__log = { errors: [], checks: [] };
  window.L = function (key, value) { log[key] = value; };

  /* What makes a scenario a test rather than a probe: a named expectation
     that passes or fails, with what was actually seen when it fails. The
     suite runner counts these; a scenario with no checks only reports. */
  window.check = function (name, pass, detail) {
    log.checks.push({ name: name, pass: !!pass, detail: detail === undefined ? null : detail });
  };

  /* A scenario says when it has finished. The runner reads the log as soon
     as it does, and a run that never says so fails as unfinished. */
  window.done = function () { log.done = true; };

  /* A scenario that provokes an error on purpose declares it, and only the
     errors it names stop counting against the run; everything else still
     fails it. */
  var allowed = [];
  window.allowErrors = function (pattern) { allowed.push(pattern); };

  var consoleError = console.error;
  console.error = function () {
    var parts = Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack : String(a); });
    var text = parts.join(' ').slice(0, 400);
    var expected = allowed.some(function (pattern) { return pattern.test(text); });
    (expected ? (log.expectedErrors = log.expectedErrors || []) : log.errors).push(text);
    return consoleError.apply(console, arguments);
  };
  window.addEventListener('error', function (event) {
    log.errors.push('uncaught: ' + (event.error && event.error.stack || event.message).slice(0, 400));
  });

  var ui = function () { return window.ui; };

  window.V = {
    /* Waits for a condition instead of a fixed time, then continues either
       way: on timeout the checks that follow fail with what they saw. A
       condition that throws (the page still booting) counts as not yet. */
    until: function (ready, then, timeoutMs) {
      var deadline = Date.now() + (timeoutMs || 10000);
      var met = function () { try { return ready(); } catch (ignored) { return false; } };
      (function poll() {
        if (met() || Date.now() > deadline) then();
        else setTimeout(poll, 100);
      })();
    },

    /* Opens a tag section and an operation, presses Try it out, writes the
       body through React's own value setter (assigning .value directly does
       not notify React) and presses Execute, as a reader would. */
    execute: function (tag, operationId, body, at) {
      var id = 'operations-' + tag + '-' + operationId;
      setTimeout(function () {
        var section = document.querySelector('h3.opblock-tag[data-tag="' + tag + '"]');
        if (section && section.getAttribute('data-is-open') === 'false') section.click();
      }, at);
      setTimeout(function () {
        var block = document.getElementById(id);
        if (block && !block.classList.contains('is-open')) block.querySelector('.opblock-summary-control').click();
      }, at + 1200);
      setTimeout(function () {
        var tryOut = document.querySelector('#' + id + ' .try-out__btn');
        if (tryOut && !tryOut.classList.contains('cancel')) tryOut.click();
      }, at + 2400);
      setTimeout(function () {
        var area = document.querySelector('#' + id + ' textarea');
        if (area && body) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, body);
          area.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, at + 3400);
      setTimeout(function () {
        var run = document.querySelector('#' + id + ' button.execute');
        if (run) run.click();
      }, at + 4400);
    },
    /* Opens a tag section and one operation, nothing more. */
    open: function (tag, operationId, at) {
      setTimeout(function () {
        var section = document.querySelector('h3.opblock-tag[data-tag="' + tag + '"]');
        if (section && section.getAttribute('data-is-open') === 'false') section.click();
      }, at);
      setTimeout(function () {
        var block = document.getElementById('operations-' + tag + '-' + operationId);
        if (block && !block.classList.contains('is-open')) block.querySelector('.opblock-summary-control').click();
      }, at + 1000);
    },
    /* A response as if Execute had run, without touching the backend: the
       request is set too, both plain and mutated, because Swagger's live
       response block reads the mutated one and crashes without it. */
    fakeResponse: function (path, method, status, body, url) {
      var request = { url: url, method: method.toUpperCase(), headers: {} };
      ui().specActions.setRequest(path, method, request);
      ui().specActions.setMutatedRequest(path, method, request);
      ui().specActions.setResponse(path, method, {
        ok: status >= 200 && status < 300, status: status, url: url, headers: {},
        text: body === null || body === undefined ? '' : JSON.stringify(body)
      });
    },
    /* A JWT whose only meaningful claim is its expiry; the page checks no
       signature, so tests can set `exp` exactly. */
    jwt: function (expiresInSeconds) {
      var encode = function (value) { return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
      return encode({ alg: 'HS256' }) + '.' + encode({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + expiresInSeconds }) + '.sig';
    },
    /* Real keyboard input, delivered by the runner as trusted events (realtime
       mode only). "Tab", "Shift+Tab", "Enter", "Escape", "Space", arrows. */
    press: function (key) { (window.__verifyKeys = window.__verifyKeys || []).push(key); },
    definition: function (scheme) { return ui().specSelectors.securityDefinitions().get(scheme); },
    /* Authorizes with the store's own immutable definition, as the dialog
       does; a plain object makes Swagger's persistence step throw. */
    authorize: function (scheme, value) {
      var payload = {};
      payload[scheme] = { name: scheme, schema: this.definition(scheme), value: value };
      ui().authActions.authorize(payload);
    },
    held: function (scheme) {
      var entry = ui().authSelectors.authorized().get(scheme);
      return entry && entry.get ? entry.get('value') : null;
    },
    /* Logs out only what is held: Swagger's logout wrapper throws on a
       scheme it does not hold. */
    logoutHeld: function () {
      var names = ui().authSelectors.authorized().keySeq().toArray();
      if (names.length) ui().authActions.logout(names);
    },
    response: function (path, method) { return ui().specSelectors.responseFor(path, method); },
    status: function (path, method) { var r = this.response(path, method); return r ? r.get('status') : null; },
    json: function (path, method) {
      var r = this.response(path, method);
      try { return JSON.parse(r.get('text')); } catch (ignored) { return null; }
    },
    param: function (path, method, key) {
      var values = ui().specSelectors.parameterValues([path, method]);
      return values ? values.get(key || 'path.id') || null : null;
    },
    text: function (selector) {
      var node = document.querySelector(selector);
      return node ? node.textContent.replace(/\s+/g, ' ').trim() : null;
    },
    box: function (selector) {
      var node = document.querySelector(selector);
      if (!node) return null;
      var r = node.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
    }
  };
})();
