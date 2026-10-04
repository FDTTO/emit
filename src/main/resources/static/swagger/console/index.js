/*
 * The console over Swagger UI: a cockpit around the operations, built once
 * outside React's tree and repainted from Swagger's store on every change.
 * start(options) is the whole contract with the page: the options say what
 * the OpenAPI document cannot (scopes, credential sources, a lifecycle, a
 * walkthrough), and every part of the console that needs one stays out of
 * the way without it.
 */
import { paintActionBars } from './action-bar.js';
import { paintCredentials } from './credentials.js';
import { paintBodyEditors, paintCarriedFields, paintExampleBoxes } from './editor.js';
import { paintFailure } from './failure.js';
import { captureHistory, closeHistory } from './history.js';
import { bindCamera, paintJourney, paintJourneyRun } from './journey.js';
import { bindShortcuts } from './keyboard.js';
import { paintLifecycle, paintLifecycleCurrent } from './lifecycle.js';
import { paintLive } from './live.js';
import { paintMap, spyScroll } from './map.js';
import {
  paintGroupCounts,
  paintLastAnswers,
  paintOperations,
  paintParameterTypes,
  paintResponseRows,
  paintTitle,
  paintTopbar,
} from './operations.js';
import { paintAuthMatrix, paintScrollers, paintSteps } from './overview.js';
import { PHONE, placeStatusbar } from './phone.js';
import { paintResponseIndex } from './response-index.js';
import { paintResponseNotes, watchStore } from './responses.js';
import { paintResults } from './result.js';
import { onFrame, schedule } from './scheduler.js';
import { paintSchemas } from './schemas.js';
import { buildShell, contentPane, restoreRail, settleLoading, watchLoading } from './shell.js';
import { readSpec } from './spec.js';
import { config } from './state.js';
import {
  HEALTH_EVERY_MS,
  SHORT_SCREEN,
  applyDensity,
  checkHealth,
  paintStatusTelemetry,
  paintStatusbar,
} from './statusbar.js';

/* What a page that says nothing gets: a console over its OpenAPI document,
   with no lifecycle figure, no walkthrough and no health light. */
const DEFAULTS = {
  brand: null,
  specUrl: '/v3/api-docs',
  scopes: {},
  credentialSources: [],
  healthPath: null,
  lifecycle: null,
  journey: [],
  actionIcons: {},
  resourceIcons: {},
  sharedRefusals: [],
  failureHint: '',
  ownHeaders: [],
};

export function start(options) {
  Object.assign(config, DEFAULTS, options);
  onFrame(paint);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

function paint() {
  readSpec();
  watchStore();
  paintFailure();
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
  paintJourneyRun();
  paintExampleBoxes();
  paintLifecycle();
  paintScrollers();
  paintMap();
  paintStatusbar();
  paintJourney();
  paintLive();
  paintStatusTelemetry();
  paintLastAnswers();
  captureHistory();
  paintActionBars();
  spyScroll();
  settleLoading();
}

function boot() {
  applyDensity();
  SHORT_SCREEN.addEventListener('change', applyDensity);
  buildShell();
  applyDensity();
  watchLoading();
  restoreRail();
  paint();
  placeStatusbar();
  PHONE.addEventListener('change', placeStatusbar);
  bindShortcuts();
  bindCamera();
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.emit-history__panel, .emit-history')) closeHistory();
  });

  /* The content pane scrolls, not the page. Capture, because the pane is
     created by React after this runs. */
  document.addEventListener(
    'scroll',
    function (event) {
      if (event.target === contentPane() || event.target === document) {
        spyScroll();
        closeHistory();
      }
    },
    true,
  );

  const root = document.getElementById('swagger-ui');
  if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });

  /* Background tabs throttle timers; repaint when the tab comes back. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      schedule();
      checkHealth();
    }
  });
  if (config.healthPath) setInterval(checkHealth, HEALTH_EVERY_MS);

  /* Whether a region overflows depends on the width, which no mutation reports. */
  window.addEventListener('resize', schedule);
}
