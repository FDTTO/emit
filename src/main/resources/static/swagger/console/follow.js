/*
 * A run of the configured lifecycle, followed: started by its call, read
 * back on a backoff until terminal, timed from the server's stamps.
 */
import { heldCredential } from './auth.js';
import { el, icon } from './dom.js';
import { openOperation } from './operations.js';
import { carriedFrom, carriedIds, responseNotes } from './responses.js';
import { schedule } from './scheduler.js';
import { headerNumber, idFromUrl, jsonBody, operationIndex } from './spec.js';
import { config, runtime } from './state.js';

/* After the start call is accepted, read the state back until it is
   terminal. A run can take milliseconds, so the first read comes soon;
   reads spend the caller's rate limit, so the rest back off: 1s, 2s, 4s,
   then every 8s, nine at most. They stop at a terminal
   state, a 429 or any failure, with a manual retry. */
const FOLLOW_DELAYS = [250, 1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000];

let followRun = 0;

/* Stops while `RateLimit-Remaining` still leaves the reader requests of
   their own this minute. */
const FOLLOW_RESERVE = 2;

export function followOperation(role) {
  if (!config.lifecycle) return null;
  const target = config.lifecycle.follow && config.lifecycle.follow[role];
  if (!target || !runtime.spec || !runtime.spec.paths || !runtime.spec.paths[target.path]) return null;
  return runtime.spec.paths[target.path][target.method] ? target : null;
}

export function lifecycleStep(state) {
  if (!config.lifecycle) return null;
  return config.lifecycle.run.concat(config.lifecycle.outcomes).filter(function (step) {
    return step.state === state;
  })[0] || null;
}

/* The run's states in order, and what a state is for: its kind. */
export function runStates() {
  return config.lifecycle.run.filter(function (step) { return step.state; }).map(function (step) { return step.state; });
}

export function kindOf(state) {
  const step = lifecycleStep(state);
  return step ? step.kind : null;
}

/* The call that starts a run, as a verb: the last segment of its path. */
function startVerb() {
  return config.lifecycle.follow.start.path.split('/').pop();
}

/* An operation as the spec names it, for a title. */
function summaryOf(target) {
  const operation = target && runtime.spec.paths[target.path][target.method];
  return operation && operation.summary ? operation.summary : target.method.toUpperCase() + ' ' + target.path;
}

export function isTerminal(state) {
  return !!config.lifecycle && config.lifecycle.outcomes.some(function (step) { return step.state === state; });
}

/* Starts at the first state without a read: the start call is accepted
   only from there, so an accepted one says where the run is.
   The id comes from the request URL, since a 202 has no body. */
export function startFollow(source, response) {
  const start = followOperation('start');
  if (!start || source.method !== start.method || source.path !== start.path) return null;
  const id = idFromUrl(start.path, response.get('url'));
  if (!id) return null;
  /* startedAt and endedAt are the browser's clock, for the timer that ticks
     while the run is followed; the spans reported come from the server. */
  const follow = { id: id, state: runStates()[0], phase: 'following', reads: 0, run: 0,
                 startedAt: Date.now(), endedAt: null, stamps: null };
  restartFollow(follow);
  return follow;
}

/* A 409 from the start call says the run is already past its first
   state: it is followed from a read at once, so one already done still
   offers its result instead of leaving the reader on a refusal. */
export function resumeFollow(source, response) {
  const start = followOperation('start');
  if (!start || source.method !== start.method || source.path !== start.path || response.get('status') !== 409) return null;
  const id = idFromUrl(start.path, response.get('url'));
  if (!id) return null;
  const body = jsonBody(response);
  const named = body && config.lifecycle.conflictState ? config.lifecycle.conflictState(body) : null;
  const state = named && lifecycleStep(named) ? named : runStates()[1];
  const follow = { id: id, state: state, phase: 'following', reads: 0, run: ++followRun,
                 startedAt: Date.now(), endedAt: null, stamps: null, resumed: true };
  readState(follow, 0);
  return follow;
}

function readStamps(body) {
  const stamps = {};
  Object.keys(config.lifecycle.stamps).forEach(function (name) {
    const time = Date.parse(body[config.lifecycle.stamps[name]]);
    stamps[name] = isNaN(time) ? null : time;
  });
  return stamps;
}

/* Time waiting and time working, from the server's stamps: exact to the
   millisecond whatever the pace of the reads. Null until both ends of a
   span are known. */
export function stageSpans(follow) {
  const at = follow.stamps || {};
  const span = function (from, to) {
    return typeof at[from] === 'number' && typeof at[to] === 'number' ? at[to] - at[from] : null;
  };
  return { queued: span('queued', 'started'), working: span('started', 'finished'), total: span('queued', 'finished') };
}

export function formatSpan(ms) {
  return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + 's';
}

/* One run at a time: reads still pending for an older run are ignored. */
function restartFollow(follow) {
  follow.run = ++followRun;
  follow.phase = 'following';
  scheduleRead(follow, 0);
}

function scheduleRead(follow, attempt) {
  const run = follow.run;
  setTimeout(function () {
    if (follow.run === run) readState(follow, attempt);
  }, FOLLOW_DELAYS[attempt]);
}

function readState(follow, attempt) {
  const read = followOperation('read');
  const headers = read ? authHeaders(read) : null;
  if (!headers) {
    follow.phase = 'no-credential';
    schedule();
    return;
  }
  const run = follow.run;
  follow.reads++;
  fetch(read.path.replace('{id}', encodeURIComponent(follow.id)), { headers: headers, credentials: 'same-origin' })
    .then(function (response) {
      const budget = {
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
        const state = result.body && result.body[config.lifecycle.field];
        if (typeof state === 'string' && lifecycleStep(state)) follow.state = state;
        follow.stamps = readStamps(result.body);
        if (isTerminal(follow.state)) {
          follow.phase = 'ended';
          follow.endedAt = Date.now();
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
  const operation = runtime.spec.paths[target.path][target.method];
  const requirements = operation.security || runtime.spec.security || [];
  const schemes = (runtime.spec.components && runtime.spec.components.securitySchemes) || {};
  for (let i = 0; i < requirements.length; i++) {
    const names = Object.keys(requirements[i]);
    const headers = {};
    const complete = names.length > 0 && names.every(function (name) {
      const scheme = schemes[name];
      const value = heldCredential(name);
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
  const trail = el('span', 'emit-note__trail');
  let order = config.lifecycle.run.filter(function (step) { return step.state; });
  if (isTerminal(state)) order = order.concat([lifecycleStep(state)]);
  const reached = order.map(function (step) { return step.state; }).indexOf(state);
  order.slice(0, reached + 1).forEach(function (step, position) {
    if (position) trail.appendChild(el('span', 'emit-note__sep', '\u2192'));
    const mark = el('span', 'emit-note__state emit-note__state--' + step.kind, step.state);
    if (position < reached) mark.classList.add('is-past');
    trail.appendChild(mark);
  });
  return trail;
}

export function followNote(follow) {
  const bar = el('div', 'emit-note emit-note--follow');
  bar.setAttribute('role', 'status');
  bar.appendChild(icon('bolt'));
  const text = el('span', 'emit-note__text');
  /* The id links to the operation that reads it, already filled in. */
  text.appendChild(document.createTextNode(config.lifecycle.subject + ' '));
  const named = el('button', 'emit-note__link', follow.id.slice(0, 8));
  named.type = 'button';
  named.title = 'Open ' + summaryOf(followOperation('read')) + ' for ' + follow.id;
  named.addEventListener('click', function () { openFollowed('read', follow.id); });
  text.appendChild(named);
  text.appendChild(document.createTextNode(' '));
  text.appendChild(stateTrail(follow.state));
  bar.appendChild(text);

  let said = null;
  let action = null;
  if (follow.phase === 'following') {
    said = 'checking';
  } else if (follow.phase === 'ended' && kindOf(follow.state) === 'done' && followOperation('result')) {
    const took = stageSpans(follow).total;
    const done = lifecycleStep(follow.state).said;
    said = (follow.resumed ? config.lifecycle.already + ': ' : '')
      + (took !== null ? done + ' ' + formatSpan(took) + ' after ' + startVerb() + '.' : done + '.');
    action = el('button', 'emit-note__action');
    action.appendChild(icon('download'));
    action.appendChild(document.createTextNode('Download ' + config.lifecycle.result));
    action.addEventListener('click', function () { openFollowed('result', follow.id); });
  } else if (follow.phase === 'ended') {
    const failedAfter = stageSpans(follow).total;
    const failed = kindOf(follow.state) === 'failed' ? lifecycleStep(follow.state).said : null;
    said = !failed ? null
      : failedAfter !== null ? failed + ' ' + formatSpan(failedAfter) + ' after ' + startVerb() + '.' : failed + '.';
  } else if (follow.phase === 'paused') {
    said = 'Still ' + follow.state + ' after ' + follow.reads + ' checks.';
  } else if (follow.phase === 'rate-limited') {
    said = follow.retryAfter
      ? 'Rate limit reached; resuming in ' + follow.retryAfter + 's.'
      : 'Stopped: the rate limit was reached.';
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

  const resumesOnItsOwn = follow.phase === 'rate-limited' && follow.retryAfter;
  const stopped = ['paused', 'rate-limited', 'saving-budget', 'error'].indexOf(follow.phase) >= 0;
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

/* Opens 'read' or 'result' for the followed run, not whatever id the
   field last held. */
export function openFollowed(role, id) {
  const operation = followOperation(role);
  if (!operation) return;
  const ui = window.ui;
  const parameters = ui.specSelectors.specJson().getIn(['paths', operation.path, operation.method, 'parameters']);
  const parameter = parameters && parameters.find(function (candidate) {
    return candidate.get('name') === 'id' && candidate.get('in') === 'path';
  });
  if (parameter) {
    ui.specActions.changeParamByIdentity([operation.path, operation.method], parameter, id);
    carriedIds[operation.method + ' ' + operation.path] = id;
    carriedFrom[operation.method + ' ' + operation.path] = 'the followed run';
  }
  const target = operationIndex()[operation.method.toUpperCase() + ' ' + operation.path];
  if (target) openOperation(target);
}

export function currentFollow() {
  let follow = null;
  Object.keys(responseNotes).forEach(function (key) {
    if (responseNotes[key] && responseNotes[key].follow) follow = responseNotes[key].follow;
  });
  return follow;
}
