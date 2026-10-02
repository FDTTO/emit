/*
 * The followed run in the rail: its stage, its time and its result.
 */
import { el, icon } from './dom.js';
import { currentFollow, followOperation, formatSpan, isTerminal, kindOf, lifecycleStep, openFollowed, runStates, stageSpans } from './follow.js';
import { paintLivePill } from './phone.js';
import { schedule } from './scheduler.js';
import { config } from './state.js';

/* The followed run, where the reader is: its stage, how long it has
   run, and the download once the result is ready. Absent when nothing runs. */
let liveTicker = null;

export function paintLive() {
  const live = document.getElementById('emit-live');
  if (!live) return;
  const follow = currentFollow();
  live.hidden = !follow;
  const run = document.getElementById('emit-status-run');
  if (run) run.hidden = !follow;
  if (!follow) {
    paintLivePill(null);
    return;
  }

  const ended = follow.phase === 'ended';
  const spans = stageSpans(follow);
  /* While it runs, how long the console has been watching; once it ends,
     how long the run took on the server, which the reads' pace never
     stretches. */
  const elapsed = ended && spans.total !== null ? formatSpan(spans.total)
    : (((follow.endedAt || Date.now()) - follow.startedAt) / 1000).toFixed(1) + 's';
  const stages = runStates().concat(isTerminal(follow.state) ? follow.state : config.lifecycle.outcomes[0].state);
  const at = stages.indexOf(follow.state);

  const key = follow.id + follow.state + follow.phase;
  if (live.dataset.key !== key) {
    live.dataset.key = key;
    live.textContent = '';
    const head = el('div', 'emit-live__head');
    head.appendChild(el('i', 'emit-live__dot' + (ended ? '' : ' is-running')));
    head.appendChild(document.createTextNode(config.lifecycle.subject + ' ' + follow.id.slice(0, 8)));
    head.appendChild(el('small', 'emit-live__elapsed'));
    live.appendChild(head);

    const track = el('div', 'emit-live__track');
    stages.forEach(function (state, index) {
      const stage = el('div', 'emit-live__stage');
      if (index < at) stage.classList.add('is-past');
      if (index === at) stage.classList.add(kindOf(state) === 'done' ? 'is-good' : kindOf(state) === 'failed' ? 'is-bad' : 'is-current');
      stage.appendChild(el('i'));
      stage.appendChild(el('b', null, state));
      track.appendChild(stage);
    });
    [spans.queued, spans.working].forEach(function (span, index) {
      if (span === null) return;
      const time = track.appendChild(el('small', 'emit-live__span', formatSpan(span)));
      time.style.left = (index + 1) * 100 / 3 + '%';
    });
    live.appendChild(track);

    const foot = el('div', 'emit-live__foot');
    const said = { following: lifecycleStep(follow.state).waiting,
                 ended: lifecycleStep(follow.state).said,
                 paused: 'Still ' + follow.state + ', paused',
                 'rate-limited': 'Waiting for the rate limit',
                 'saving-budget': 'Paused to save your requests',
                 error: 'Reading it back failed',
                 'no-credential': 'No key to read it back with' }[follow.phase] || '';
    foot.appendChild(el('span', null, said));
    if (ended && kindOf(follow.state) === 'done' && followOperation('result')) {
      const download = el('button', 'emit-live__action');
      download.type = 'button';
      download.appendChild(icon('download'));
      download.appendChild(document.createTextNode('Download ' + config.lifecycle.result));
      download.addEventListener('click', function () { openFollowed('result', follow.id); });
      foot.appendChild(download);
    }
    live.appendChild(foot);

    if (run) {
      run.textContent = '';
      run.appendChild(el('i', 'emit-live__dot' + (ended ? '' : ' is-running')));
      run.appendChild(document.createTextNode(config.lifecycle.subject + ' ' + follow.id.slice(0, 8) + ' · ' + follow.state));
    }
  }
  live.querySelector('.emit-live__elapsed').textContent = elapsed;
  paintLivePill(follow, stages, at, elapsed);

  if (!ended && !liveTicker) liveTicker = setInterval(schedule, 200);
  if (ended && liveTicker) {
    clearInterval(liveTicker);
    liveTicker = null;
  }
}
