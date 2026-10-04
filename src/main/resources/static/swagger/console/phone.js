/*
 * The cockpit folded for a phone: the drawer, the strip and the run's pill.
 */
import { el, icon } from './dom.js';
import { followOperation, kindOf, openFollowed } from './follow.js';
import { config } from './state.js';

/* Below 900px the cockpit folds for a thumb: the journey becomes a strip
   under the bar, the run a pill over the page, and the rail a drawer the
   menu opens, with the statusbar's telemetry at its foot. */
export const PHONE = window.matchMedia('(max-width: 900px)');

/* The statusbar is the drawer's foot on a phone and the window's last row
   otherwise; it is the page's own node, so it can move. */
export function placeStatusbar() {
  const win = document.getElementById('emit-window');
  const rail = document.getElementById('emit-rail');
  const status = document.getElementById('emit-statusbar');
  if (!win || !rail || !status) return;
  const home = PHONE.matches ? rail : win;
  if (status.parentNode !== home) home.appendChild(status);
  if (!PHONE.matches) setDrawer(false);
}

export function setDrawer(open) {
  const win = document.getElementById('emit-window');
  if (!win) return;
  win.dataset.drawer = open ? 'open' : '';
  const menu = document.getElementById('emit-menu');
  if (menu) menu.setAttribute('aria-expanded', String(open));
  if (open) {
    /* A hidden drawer cannot take focus. Reading its computed visibility
       applies the open state now, where waiting for a frame could wait
       long in a throttled tab. */
    const here =
      document.querySelector('#emit-map .emit-map__item.is-current') ||
      document.querySelector('#emit-map .emit-map__item');
    if (here && getComputedStyle(document.getElementById('emit-rail')).visibility === 'visible') here.focus();
  } else if (menu && document.getElementById('emit-rail').contains(document.activeElement)) {
    menu.focus();
  }
}

export function paintStrip(state) {
  const topbar = document.querySelector('.swagger-container > .topbar');
  let strip = document.getElementById('emit-strip');
  if (!topbar) return;
  if (!strip) {
    strip = el('div', 'emit-strip');
    strip.id = 'emit-strip';
    const bar = strip.appendChild(el('div', 'emit-strip__bar'));
    config.journey.forEach(function () {
      bar.appendChild(el('i'));
    });
    const next = strip.appendChild(el('button', 'emit-strip__next'));
    next.type = 'button';
    next.appendChild(el('small', null, 'NEXT'));
    next.appendChild(el('span', 'emit-strip__step'));
    next.appendChild(icon('goTo'));
    next.addEventListener('click', function () {
      document.querySelector('.emit-journey__next').click();
    });
    topbar.parentNode.insertBefore(strip, topbar.nextSibling);
  }
  strip.querySelectorAll('.emit-strip__bar i').forEach(function (segment, index) {
    segment.className = state.done[index] ? 'is-done' : index === state.next ? 'is-next' : '';
  });
  strip.querySelector('.emit-strip__next').hidden = state.next < 0;
  if (state.next >= 0) strip.querySelector('.emit-strip__step').textContent = config.journey[state.next].label;
}

/* The run as a pill over the page: its id, the stages as dots, the state
   it is in and how long it has run. */
export function paintLivePill(follow, stages, at, elapsed) {
  const win = document.getElementById('emit-window');
  let pill = document.getElementById('emit-live-pill');
  if (!follow) {
    if (pill) pill.hidden = true;
    return;
  }
  if (!pill) {
    pill = win.appendChild(el('div', 'emit-live-pill'));
    pill.id = 'emit-live-pill';
    pill.setAttribute('role', 'status');
  }
  pill.hidden = false;
  const key = follow.id + follow.state + follow.phase;
  if (pill.dataset.key !== key) {
    pill.dataset.key = key;
    pill.textContent = '';
    pill.appendChild(el('i', 'emit-live__dot' + (follow.phase === 'ended' ? '' : ' is-running')));
    pill.appendChild(document.createTextNode(follow.id.slice(0, 8)));
    const dots = pill.appendChild(el('span', 'emit-live-pill__stages'));
    stages.forEach(function (state, index) {
      dots.appendChild(
        el(
          'i',
          index < at
            ? 'is-past'
            : index === at
              ? kindOf(state) === 'done'
                ? 'is-good'
                : kindOf(state) === 'failed'
                  ? 'is-bad'
                  : 'is-current'
              : '',
        ),
      );
    });
    pill.appendChild(el('em', 'emit-live-pill__state is-' + follow.state.toLowerCase(), follow.state));
    pill.appendChild(el('span', 'emit-live-pill__elapsed'));
    /* Done, the pill hands over what the run was for. */
    if (follow.phase === 'ended' && kindOf(follow.state) === 'done' && followOperation('result')) {
      const download = pill.appendChild(el('button', 'emit-live-pill__action'));
      download.type = 'button';
      download.setAttribute('aria-label', 'Download the ' + config.lifecycle.result);
      download.appendChild(icon('download'));
      download.appendChild(document.createTextNode(config.lifecycle.result));
      download.addEventListener('click', function () {
        openFollowed('result', follow.id);
      });
    }
  }
  pill.querySelector('.emit-live-pill__elapsed').textContent = elapsed;
}
