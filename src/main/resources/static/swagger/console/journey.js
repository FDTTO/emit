/*
 * The walkthrough: the configured steps, each done when the page sees
 * what it leaves behind, and Run all steps with its camera.
 */
import { heldCredential } from './auth.js';
import { el, icon } from './dom.js';
import { setAreaValue } from './editor.js';
import { currentFollow, kindOf } from './follow.js';
import { typing } from './keyboard.js';
import { bringIntoView, openOperation } from './operations.js';
import { paintStrip } from './phone.js';
import { lastAnswers } from './responses.js';
import { schedule } from './scheduler.js';
import { contentPane } from './shell.js';
import { operationIndex } from './spec.js';
import { config, runtime } from './state.js';

const STEP_WAIT_MS = 30000;

const STEP_PAUSE_MS = 700;

function toggleJourneyRun() {
  if (runtime.autopilot) stopJourney();
  else runJourney();
}

export function runJourney() {
  if (!runtime.spec || journeyState().next < 0) return;
  runtime.autopilot = { step: -1, run: {}, camera: 'follow' };
  schedule();
  nextJourneyStep(runtime.autopilot);
}

/* The camera follows the run until the reader scrolls: taking the scroll
   takes the camera, and the run goes on without moving the page under
   them. Follow hands it back, at the step being run. */
function releaseCamera(event) {
  if (!runtime.autopilot || runtime.autopilot.camera !== 'follow') return;
  const pane = contentPane();
  if (event && event.type !== 'keydown' && pane && !pane.contains(event.target)) return;
  runtime.autopilot.camera = 'free';
  schedule();
}

function toggleCamera() {
  if (!runtime.autopilot) return;
  if (runtime.autopilot.camera === 'follow') {
    runtime.autopilot.camera = 'free';
  } else {
    runtime.autopilot.camera = 'follow';
    const step = config.journey[runtime.autopilot.step];
    const target = step && operationIndex()[step.method.toUpperCase() + ' ' + step.path];
    const block = target && document.getElementById('operations-' + target.tag + '-' + target.id);
    if (block) bringIntoView(block);
  }
  schedule();
}

export function bindCamera() {
  ['wheel', 'touchmove'].forEach(function (type) {
    document.addEventListener(type, releaseCamera, { passive: true });
  });
  document.addEventListener('keydown', function (event) {
    if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown| )$/.test(event.key) && !typing(event.target))
      releaseCamera(event);
  });
}

export function stopJourney() {
  runtime.autopilot = null;
  schedule();
}

/* Polls a condition while the run it belongs to is still the current one. */
function whileRunning(run, ready, then, waitMs) {
  const deadline = Date.now() + (waitMs || STEP_WAIT_MS);
  (function poll() {
    if (runtime.autopilot !== run) return;
    const met = ready();
    if (met) return then(met);
    if (Date.now() > deadline) return stopJourney();
    setTimeout(poll, 120);
  })();
}

function nextJourneyStep(run) {
  if (runtime.autopilot !== run) return;
  const index = journeyState().next;
  /* Done, or the step just tried is still not done: either way, stop. */
  if (index < 0 || index === run.step) return stopJourney();
  run.step = index;
  schedule();
  const step = config.journey[index];
  const key = step.method.toUpperCase() + ' ' + step.path;
  const target = operationIndex()[key];
  if (!target) return stopJourney();
  openOperation(target, { scroll: run.camera === 'follow' });
  const before = lastAnswers[key];
  whileRunning(
    run,
    function () {
      const block = document.getElementById('operations-' + target.tag + '-' + target.id);
      const button = block && block.querySelector('.opblock-body button.execute');
      return button && !button.disabled && button.getBoundingClientRect().height > 0 ? block : null;
    },
    function (block) {
      setTimeout(function () {
        if (runtime.autopilot !== run) return;
        if (step.body) fillBody(block, step.body(Date.now().toString(36)));
        block.querySelector('.opblock-body button.execute').click();
        whileRunning(
          run,
          function () {
            return lastAnswers[key] !== before ? lastAnswers[key] : null;
          },
          function (answer) {
            if (!answer.status || answer.status >= 300) return stopJourney();
            whileRunning(
              run,
              function () {
                const follow = step.done.run ? currentFollow() : null;
                if (follow && kindOf(follow.state) === 'failed') {
                  stopJourney();
                  return null;
                }
                return stepDone(step);
              },
              function () {
                setTimeout(function () {
                  nextJourneyStep(run);
                }, STEP_PAUSE_MS);
              },
            );
          },
        );
      }, STEP_PAUSE_MS);
    },
  );
}

/* A step's own body, from the configuration's body(stamp): a run that must
   send something new each time (a name that has to be unique) says so there. */
function fillBody(block, value) {
  const area = block.querySelector('textarea.body-param__text');
  if (area) setAreaValue(area, JSON.stringify(value, null, 2));
}

/* The run's control, at the end of the Getting started heading. */
export function paintJourneyRun() {
  if (!config.journey.length) return;
  let heading = document.querySelector('.information-container .info ol');
  heading = heading && heading.previousElementSibling;
  if (!heading || !/^H[2-4]$/.test(heading.tagName)) return;
  let button = heading.querySelector('.emit-journey-run');
  if (!button) {
    button = el('button', 'emit-journey-run emit-primary');
    button.type = 'button';
    button.addEventListener('click', toggleJourneyRun);
    heading.appendChild(button);
  }
  const finished = journeyState().next < 0;
  const key = (runtime.autopilot ? 'run' : 'idle') + finished;
  if (button.dataset.key === key) return;
  button.dataset.key = key;
  button.hidden = finished && !runtime.autopilot;
  button.textContent = '';
  button.appendChild(icon(runtime.autopilot ? 'stop' : 'play'));
  button.appendChild(document.createTextNode(runtime.autopilot ? 'Stop' : 'Run all steps'));
  button.setAttribute(
    'aria-label',
    runtime.autopilot ? 'Stop running the steps' : 'Run the remaining steps, one after another',
  );
}

function stepDone(step) {
  if (step.done.held) return !!(window.ui && window.ui.authSelectors && heldCredential(step.done.held));
  if (step.done.run) {
    const follow = currentFollow();
    return !!follow && follow.state === step.done.run;
  }
  const answer = lastAnswers[step.method.toUpperCase() + ' ' + step.path];
  return !!answer && answer.status >= 200 && answer.status < 300;
}

export function journeyState() {
  const done = config.journey.map(stepDone);
  /* In a chain, a later step proves the earlier ones: a result downloaded
     was generated, and what was generated was created. */
  for (let i = config.journey.length - 2; i >= 0; i--) {
    if (config.journey[i].chain && config.journey[i + 1].chain && done[i + 1]) done[i] = true;
  }
  return { done: done, next: done.indexOf(false) };
}

/* The rail's compact walkthrough: progress and the one step that is next. */
export function paintJourney() {
  const journey = document.getElementById('emit-journey');
  if (!journey || !runtime.spec || !config.journey.length) return;
  if (!journey.firstChild) {
    const label = el('div', 'emit-rail__label', 'Getting started');
    label.appendChild(el('small', 'emit-journey__count'));
    journey.appendChild(label);
    const bar = el('div', 'emit-journey__bar');
    config.journey.forEach(function () {
      bar.appendChild(el('i'));
    });
    journey.appendChild(bar);
    const next = el('button', 'emit-journey__next');
    next.type = 'button';
    const words = el('span', 'emit-journey__words');
    words.appendChild(el('small', 'emit-journey__kind', 'Next'));
    words.appendChild(el('span', 'emit-journey__step'));
    next.appendChild(words);
    next.appendChild(icon('goTo'));
    next.addEventListener('click', function () {
      const step = config.journey[journeyState().next];
      const target = step && operationIndex()[step.method.toUpperCase() + ' ' + step.path];
      if (target) openOperation(target);
    });
    journey.appendChild(next);
    const tools = el('div', 'emit-journey__tools');
    const run = tools.appendChild(el('button', 'emit-journey__tool emit-journey__run'));
    run.type = 'button';
    run.addEventListener('click', toggleJourneyRun);
    const camera = tools.appendChild(el('button', 'emit-journey__tool emit-journey__camera'));
    camera.type = 'button';
    camera.addEventListener('click', toggleCamera);
    journey.appendChild(tools);
    journey.hidden = false;
  }
  const state = journeyState();
  paintStrip(state);
  const count = state.done.filter(Boolean).length;
  const key =
    state.done.join() + state.next + !!runtime.autopilot + (runtime.autopilot ? runtime.autopilot.camera : '');
  if (journey.dataset.key === key) return;
  journey.dataset.key = key;
  journey.querySelector('.emit-journey__count').textContent = count + ' / ' + config.journey.length;
  journey.querySelectorAll('.emit-journey__bar i').forEach(function (segment, index) {
    segment.className = state.done[index] ? 'is-done' : index === state.next ? 'is-next' : '';
  });
  const nextButton = journey.querySelector('.emit-journey__next');
  nextButton.hidden = state.next < 0;
  if (state.next >= 0) journey.querySelector('.emit-journey__step').textContent = config.journey[state.next].label;
  journey.querySelector('.emit-journey__kind').textContent = runtime.autopilot ? 'Running' : 'Next';
  journey.classList.toggle('is-running', !!runtime.autopilot);

  const runButton = journey.querySelector('.emit-journey__run');
  runButton.hidden = state.next < 0 && !runtime.autopilot;
  runButton.textContent = '';
  runButton.appendChild(icon(runtime.autopilot ? 'stop' : 'play'));
  runButton.appendChild(document.createTextNode(runtime.autopilot ? 'Stop' : 'Run all steps'));
  const following = !!runtime.autopilot && runtime.autopilot.camera === 'follow';
  const cameraButton = journey.querySelector('.emit-journey__camera');
  cameraButton.hidden = !runtime.autopilot;
  cameraButton.setAttribute('aria-pressed', String(following));
  cameraButton.title = following
    ? 'The page follows the run. Scroll to look around on your own.'
    : 'Bring the page back to the step being run, and follow it';
  cameraButton.textContent = '';
  cameraButton.appendChild(icon('eye'));
  cameraButton.appendChild(document.createTextNode(following ? 'Following' : 'Follow'));
  journey.querySelector('.emit-journey__tools').hidden = runButton.hidden;
}
