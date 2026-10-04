/*
 * The operations as Swagger lists them, dressed: the topbar and title,
 * icons and scopes per row, counts per section, and opening one.
 */
import {
  armExpiry,
  authorizedScopes,
  isExpired,
  openCredentialSource,
  scopeBadge,
  scopeColor,
  scopesFor,
} from './auth.js';
import { openCredentials } from './credentials.js';
import { el, icon, iconFor, plural } from './dom.js';
import { specFailed } from './failure.js';
import { openPalette } from './palette.js';
import { setDrawer } from './phone.js';
import { lastAnswers } from './responses.js';
import { statusWords, toneOf } from './result.js';
import { contentPane, toggleRail } from './shell.js';
import { operationCountByTag, operationIndex, operationsOfTag } from './spec.js';
import { config } from './state.js';

/* Replaces the Swagger logo with the brand's wordmark and mirrors Authorize in
   the topbar as a credential tag that shows what is held. */
export function paintTopbar() {
  const bar = document.querySelector('.topbar .topbar-wrapper');
  if (!bar) return;

  const link = bar.querySelector('a');
  if (link && config.brand && !link.querySelector('.emit-brand')) {
    const brand = el('span', 'emit-brand', config.brand);
    brand.appendChild(el('span', 'emit-brand__dot', '.'));
    link.textContent = '';
    link.appendChild(brand);
  }
  if (!document.getElementById('emit-menu')) {
    const menu = el('button', 'emit-menu');
    menu.id = 'emit-menu';
    menu.type = 'button';
    menu.setAttribute('aria-label', 'Open the map');
    menu.setAttribute('aria-controls', 'emit-rail');
    menu.setAttribute('aria-expanded', 'false');
    menu.appendChild(icon('menu'));
    menu.addEventListener('click', function () {
      setDrawer(document.getElementById('emit-window').dataset.drawer !== 'open');
    });
    bar.insertBefore(menu, link || bar.firstChild);
  }
  if (!document.getElementById('emit-crumb')) {
    const crumb = el('div', 'emit-crumb');
    crumb.id = 'emit-crumb';
    bar.insertBefore(crumb, link ? link.nextSibling : bar.firstChild);
  }
  if (!document.getElementById('emit-rail-toggle')) {
    const fold = el('button', 'emit-rail-toggle');
    fold.id = 'emit-rail-toggle';
    fold.type = 'button';
    fold.title = 'Fold the rail (Ctrl B)';
    fold.setAttribute('aria-label', 'Fold the rail');
    fold.appendChild(icon('chevronLeft'));
    fold.addEventListener('click', toggleRail);
    bar.insertBefore(fold, document.getElementById('emit-crumb'));
  }
  if (!document.getElementById('emit-jump')) {
    const jump = el('button', 'emit-jump');
    jump.id = 'emit-jump';
    jump.type = 'button';
    jump.appendChild(icon('search'));
    jump.appendChild(el('span', null, 'Jump to an operation'));
    jump.appendChild(el('kbd', null, 'Ctrl K'));
    jump.addEventListener('click', openPalette);
    bar.insertBefore(jump, document.getElementById('emit-crumb').nextSibling);
  }

  /* Present once Swagger knows the schemes, and on a failed description,
     where its dialog says why it is empty. */
  const source = document.querySelector('.scheme-container .auth-wrapper .authorize');
  let mirror = document.getElementById('emit-topbar-auth');
  if (!source && !specFailed()) {
    if (mirror) mirror.remove();
    return;
  }
  if (!mirror) {
    mirror = document.createElement('button');
    mirror.id = 'emit-topbar-auth';
    mirror.type = 'button';
    mirror.addEventListener('click', function () {
      /* Only expired credentials held: the way back is logging in again. */
      const held = authorizedScopes();
      const now = Date.now();
      if (
        held.length &&
        held.every(function (h) {
          return isExpired(h, now);
        })
      ) {
        const scheme = Object.keys(config.scopes).filter(function (s) {
          return config.scopes[s] === held[0].scope;
        })[0];
        if (openCredentialSource(scheme)) return;
      }
      openCredentials();
    });
    bar.appendChild(mirror);
  }

  /* `data-state` names the credentials that still work and drives the tint;
     the key also tracks expiries. Rebuilt only when the key changes, or every
     mutation would restart the transitions. */
  const now = Date.now();
  const held = authorizedScopes();
  const live = held.filter(function (h) {
    return !isExpired(h, now);
  });
  const expired = held.filter(function (h) {
    return isExpired(h, now);
  });
  const labels = function (list) {
    return list.map(function (h) {
      return h.scope.label;
    });
  };
  const key = held
    .map(function (h) {
      return h.scope.label + (isExpired(h, now) ? ':expired' : '');
    })
    .join(',');
  armExpiry(held, now);
  if (mirror.dataset.key === key) return;
  mirror.dataset.key = key;
  /* Expired is not empty: Execute would still send a token that will be rejected. */
  mirror.dataset.state = held.length && !live.length ? 'EXPIRED' : labels(live).join(',');
  mirror.textContent = '';

  if (!held.length) {
    mirror.appendChild(el('span', 'emit-auth-cta', 'Authorize'));
    mirror.setAttribute('aria-label', 'Authorize');
    mirror.title = 'Authorize';
    return;
  }

  /* One segment per credential, glyph and label from `SCOPE_BY_SCHEME`, divided
     by a hairline. Expired ones stay, dimmed and flagged: Authorize still sends
     them. */
  held.forEach(function (h) {
    const gone = isExpired(h, now);
    const seg = el('span', 'emit-auth-seg emit-auth-seg--' + h.scope.key + (gone ? ' emit-auth-seg--expired' : ''));
    if (!gone) scopeColor(seg, h.scope);
    if (h.scope.icon) seg.appendChild(icon(h.scope.icon));
    seg.appendChild(el('span', 'emit-auth-seg__label', h.scope.label));
    if (gone) seg.appendChild(el('span', 'emit-auth-seg__flag', 'expired'));
    mirror.appendChild(seg);
  });

  const said = [];
  if (live.length) said.push('Authorized as ' + labels(live).join(', ') + '.');
  expired.forEach(function (h) {
    said.push(h.scope.label + ' token expired.');
  });
  const summary = said.join(' ');
  // Only a JWT carries an expiry, so "only expired" always means a token
  // from a login, and the click leads to logging in again.
  const next =
    expired.length && !live.length ? 'log in again.' : expired.length ? 'authorize again.' : 'manage credentials.';
  mirror.setAttribute('aria-label', summary + ' ' + next.charAt(0).toUpperCase() + next.slice(1));
  mirror.title = summary + ' Click to ' + next;
}

/* The API title is one text node; split it into product name and
   descriptor. Scoped to the info panel, so the spec-failure heading is left
   alone. */
export function paintTitle() {
  const title = document.querySelector('.information-container .info .title');
  if (!title || title.querySelector('.emit-title-name')) return;

  for (let i = 0; i < title.childNodes.length; i++) {
    const node = title.childNodes[i];
    if (node.nodeType !== 3) continue;
    const words = node.textContent.trim().split(/\s+/);
    if (!words[0]) continue;

    const name = el('span', 'emit-title-name');
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
export function paintResponseRows() {
  const rows = document.querySelectorAll('.responses-table tbody tr');
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i].querySelector('.response-col_status');
    if (!cell) continue;
    const code = parseInt(cell.textContent, 10);
    const band =
      code >= 200 && code < 300
        ? 'resp-s2'
        : code === 429
          ? 'resp-s5'
          : code >= 400 && code < 500
            ? 'resp-s4'
            : code >= 500
              ? 'resp-s5'
              : '';
    rows[i].classList.remove('resp-s2', 'resp-s4', 'resp-s5');
    if (band) rows[i].classList.add(band);
  }
}

/* Icon and scope badge per operation, matched on data-path, never on
   visible text. */
export function paintOperations() {
  const blocks = document.querySelectorAll('.opblock');
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const summary = block.querySelector('.opblock-summary');
    if (!summary) continue;

    const pathEl = summary.querySelector('.opblock-summary-path');
    const path = pathEl && pathEl.getAttribute('data-path');
    if (!path) continue;

    const methodEl = summary.querySelector('.opblock-summary-method');
    const method = methodEl ? methodEl.textContent.trim().toLowerCase() : '';
    if (!method) continue;

    const control = summary.querySelector('.opblock-summary-control');
    if (control && !control.querySelector('.emit-op-icon')) {
      const glyph = icon(iconFor(method, path));
      if (glyph) {
        const holder = el('span', 'emit-op-icon');
        holder.appendChild(glyph);
        control.insertBefore(holder, control.firstChild);
      }
    }

    if (!summary.querySelector('.emit-scopes')) {
      const scopes = scopesFor(method, path);
      if (scopes && scopes.length) {
        const group = el('span', 'emit-scopes');
        for (let s = 0; s < scopes.length; s++) {
          group.appendChild(scopeBadge(scopes[s]));
        }
        /* Before the arrow, so the badge sits in the same place on public
           operations, which have no padlock button to anchor on. */
        const anchor = summary.querySelector('.authorization__btn') || summary.querySelector('.opblock-control-arrow');
        if (anchor) summary.insertBefore(group, anchor);
        else summary.appendChild(group);
      }
    }
  }
}

/* A parameter's type and format arrive as one element with the format
   nested in it, "string($uuid)"; they become two chips, "string" and "uuid". */
export function paintParameterTypes() {
  document.querySelectorAll('.parameter__type:not([data-emit-type])').forEach(function (type) {
    type.setAttribute('data-emit-type', '');
    const text = type.firstChild;
    if (text && text.nodeType === 3 && text.textContent.trim()) {
      const chip = el('span', 'emit-type', text.textContent.trim());
      type.replaceChild(chip, text);
    }
    const format = type.querySelector('.prop-format');
    if (format) format.textContent = format.textContent.replace(/^\(\$?|\)$/g, '');
  });
}

/* A collapsed tag has no operations in the DOM, so open the tag first and
   retry until React renders the target. */
export function openOperation(target, options) {
  const scroll = !options || options.scroll !== false;
  const section = document.querySelector('h3.opblock-tag[data-tag="' + target.tag + '"]');
  if (section && section.getAttribute('data-is-open') === 'false') section.click();

  let attempts = 0;
  (function find() {
    const block = document.getElementById('operations-' + target.tag + '-' + target.id);
    if (!block) {
      if (attempts++ < 12) requestAnimationFrame(find);
      return;
    }
    if (!block.classList.contains('is-open')) {
      const control = block.querySelector('.opblock-summary-control');
      if (control) control.click();
    }
    if (scroll) bringIntoView(block);
  })();
}

/* A smooth scroll aims at where the block is when it starts. Content that
   lands above it meanwhile (the lifecycle figure is drawn once the spec
   arrives) leaves it short, so where this scroll ends is checked and
   corrected, however long a busy page takes to end it. Never once the
   reader scrolls: from then on where the page sits is theirs. */
export function bringIntoView(block) {
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const pane = contentPane();
  if (!pane || !('onscrollend' in window)) return;
  let corrections = 0;
  const inputs = ['wheel', 'touchmove', 'keydown'];
  const stop = function () {
    pane.removeEventListener('scrollend', settle);
    inputs.forEach(function (type) {
      document.removeEventListener(type, stop, true);
    });
  };
  const settle = function () {
    const margin = parseFloat(getComputedStyle(block).scrollMarginTop) || 0;
    const off = block.getBoundingClientRect().top - pane.getBoundingClientRect().top - margin;
    if (Math.abs(off) > 4 && corrections++ < 2) {
      block.scrollIntoView({ block: 'start' });
      return;
    }
    stop();
  };
  pane.addEventListener('scrollend', settle);
  inputs.forEach(function (type) {
    document.addEventListener(type, stop, { capture: true, passive: true });
  });
}

/* Endpoint counts on group headers, from the spec: a collapsed tag renders
 * no operations, so a DOM count would read zero.
 */
export function paintGroupCounts() {
  const counts = operationCountByTag();

  document.querySelectorAll('.opblock-tag').forEach(function (header) {
    if (header.querySelector('.emit-count')) return;
    const total = counts[header.getAttribute('data-tag')];
    if (!total) return;

    const count = el('span', 'emit-count', plural(total, 'endpoint'));
    const chevron = header.querySelector('.expand-operation');
    if (chevron) header.insertBefore(count, chevron);
    else header.appendChild(count);
  });
  paintTagTools();
}

export function allShown(tag) {
  const layout = window.ui && window.ui.layoutSelectors;
  const ids = operationsOfTag(tag);
  return (
    !!layout &&
    ids.length > 0 &&
    ids.every(function (id) {
      return layout.isShown(['operations', tag, id]);
    })
  );
}

export function showAllOf(tag, open) {
  window.ui.layoutActions.show(['operations-tag', tag], true);
  operationsOfTag(tag).forEach(function (id) {
    window.ui.layoutActions.show(['operations', tag, id], open);
  });
}

function paintTagTools() {
  document.querySelectorAll('h3.opblock-tag').forEach(function (header) {
    const tag = header.getAttribute('data-tag');
    let button = header.querySelector('.emit-tag-all');
    if (!button) {
      button = el('button', 'emit-tag-all');
      button.type = 'button';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        showAllOf(tag, !allShown(tag));
      });
      const chevron = header.querySelector('.expand-operation');
      if (chevron) header.insertBefore(button, chevron);
      else header.appendChild(button);
    }
    const open = allShown(tag);
    if (button.dataset.open === String(open)) return;
    button.dataset.open = String(open);
    button.textContent = '';
    button.appendChild(icon(open ? 'fold' : 'unfold'));
    button.appendChild(document.createTextNode(open ? 'Close all' : 'Open all'));
    button.setAttribute('aria-label', (open ? 'Close every ' : 'Open every ') + tag + ' operation');
  });
}

/* What the page remembers: the last answer on each operation's row and a
   dot beside it in the map. */
export function paintLastAnswers() {
  const index = operationIndex();
  Object.keys(lastAnswers).forEach(function (key) {
    const answer = lastAnswers[key];
    const target = index[key];
    if (!target) return;
    const tone = 'is-' + toneOf(answer.status);
    const text = statusWords(answer.status);
    const took = typeof answer.duration === 'number' ? answer.duration + ' ms' : '';

    const block = document.getElementById('operations-' + target.tag + '-' + target.id);
    const summary = block && block.querySelector('.opblock-summary');
    if (summary) {
      let mark = summary.querySelector('.emit-last');
      if (!mark) {
        mark = el('span', 'emit-last');
        const scopes = summary.querySelector('.emit-scopes');
        summary.insertBefore(mark, scopes || null);
      }
      const markKey = text + took;
      if (mark.dataset.key !== markKey) {
        mark.dataset.key = markKey;
        mark.className = 'emit-last ' + tone;
        mark.textContent = text;
        if (took) mark.appendChild(el('span', 'emit-last__time', took));
      }
    }

    const link = document.querySelector(
      '.emit-map__item[data-target="operations-' + target.tag + '-' + target.id + '"]',
    );
    if (link) {
      let dot = link.querySelector('.emit-map__ran');
      if (!dot) {
        dot = el('i', 'emit-map__ran');
        link.insertBefore(dot, link.querySelector('.emit-map__scope'));
      }
      dot.className = 'emit-map__ran ' + tone;
    }
  });
}
