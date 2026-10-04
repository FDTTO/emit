/*
 * The credentials dialog: a card per security scheme, its state first and
 * the way to a credential when it is missing, over Swagger's auth actions.
 */
import {
  authorizeScheme,
  credentialSourceFor,
  expiryOf,
  heldCredential,
  heldFrom,
  masked,
  openCredentialSource,
  schemeKind,
  scopeBadge,
} from './auth.js';
import { el, icon } from './dom.js';
import { config, runtime } from './state.js';

function credentialCard(scheme, scope, definition) {
  const value = heldCredential(scheme);
  const expiresAt = expiryOf(value);
  const expired = expiresAt !== null && expiresAt <= Date.now();
  const card = el('section', 'emit-auth__cred');
  const top = el('div', 'emit-auth__top');
  top.appendChild(scopeBadge(scope));
  top.appendChild(el('span', 'emit-auth__scheme', scheme));
  top.appendChild(el('span', 'emit-auth__kind', schemeKind(definition) + (scope.serves ? ' · ' + scope.serves : '')));
  card.appendChild(top);

  const state = el('div', 'emit-auth__state' + (!value ? ' is-empty' : expired ? ' is-expired' : ''));
  const from = value && heldFrom(scheme, value);
  state.appendChild(
    document.createTextNode(!value ? 'Not held' : expired ? 'Expired' : from ? 'Held, filled from ' + from : 'Held'),
  );
  const detail = !value
    ? scope.missing
    : expiresAt === null
      ? null
      : expired
        ? 'Execute would be refused'
        : 'expires in ' + Math.max(1, Math.round((expiresAt - Date.now()) / 60000)) + ' min';
  if (detail) state.appendChild(el('small', null, detail));
  const source = credentialSourceFor(scheme);
  if ((!value || expired) && source) {
    const link = el('button', 'emit-auth__source', (expired ? source.action + ' again' : source.action) + ' ');
    link.type = 'button';
    link.appendChild(icon('goTo'));
    link.addEventListener('click', function () {
      closeCredentials();
      openCredentialSource(scheme);
    });
    state.appendChild(link);
  }
  card.appendChild(state);

  const row = el('div', 'emit-auth__row');
  const field = el('div', 'emit-auth__field');
  if (value) {
    const shown = el('span', 'emit-auth__value', masked(value));
    field.appendChild(shown);
    const eye = el('button', 'emit-auth__eye');
    eye.type = 'button';
    eye.setAttribute('aria-label', 'Show the whole ' + (source ? source.noun : 'value'));
    eye.appendChild(icon('eye'));
    eye.addEventListener('click', function () {
      const whole = shown.textContent !== value;
      shown.textContent = whole ? value : masked(value);
      eye.setAttribute('aria-pressed', String(whole));
    });
    field.appendChild(eye);
    row.appendChild(field);
    const logout = el('button', 'emit-quiet', 'Log out');
    logout.type = 'button';
    logout.addEventListener('click', function () {
      window.ui.authActions.logout([scheme]);
    });
    row.appendChild(logout);
  } else {
    const input = el('input', 'emit-auth__input');
    input.type = 'text';
    input.spellcheck = false;
    input.placeholder =
      'Paste ' + (source && source.noun === 'key' ? 'an API key' : 'a ' + (source ? source.noun : 'value'));
    input.setAttribute('aria-label', scheme);
    field.appendChild(input);
    row.appendChild(field);
    const authorize = el('button', 'emit-primary', 'Authorize');
    authorize.type = 'button';
    const submit = function () {
      if (input.value.trim()) authorizeScheme(scheme, input.value.trim());
    };
    authorize.addEventListener('click', submit);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') submit();
    });
    row.appendChild(authorize);
  }
  card.appendChild(row);
  return card;
}

function credentialsSignature() {
  return Object.keys(config.scopes)
    .map(function (scheme) {
      const value = heldCredential(scheme);
      const expiresAt = expiryOf(value);
      return (value || '') + ':' + (expiresAt === null ? '' : Math.round((expiresAt - Date.now()) / 60000));
    })
    .join('|');
}

export function paintCredentials() {
  const scrim = document.getElementById('emit-auth');
  if (!scrim || scrim.hidden) return;
  const signature = credentialsSignature();
  if (scrim.dataset.signature === signature) return;
  scrim.dataset.signature = signature;
  const list = scrim.querySelector('.emit-auth__list');
  list.textContent = '';
  if (!runtime.spec) {
    list.appendChild(el('p', 'emit-auth__empty', 'Credentials appear once the API description loads.'));
    return;
  }
  const definitions = window.ui.specSelectors.securityDefinitions();
  Object.keys(config.scopes).forEach(function (scheme) {
    const definition = definitions && definitions.get(scheme);
    if (definition) list.appendChild(credentialCard(scheme, config.scopes[scheme], definition));
  });
}

let credentialsOpener = null;

let credentialsTick = null;

export function openCredentials() {
  const host = document.getElementById('emit-window');
  if (!host) return;
  let scrim = document.getElementById('emit-auth');
  if (!scrim) {
    scrim = el('div', 'emit-auth');
    scrim.id = 'emit-auth';
    const box = el('div', 'emit-auth__box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'emit-auth-title');
    const head = el('div', 'emit-auth__head');
    const title = el('h2', null, 'Credentials');
    title.id = 'emit-auth-title';
    head.appendChild(title);
    head.appendChild(el('p', null, 'What Execute sends with each call'));
    const close = el('button', 'emit-auth__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(icon('close'));
    close.addEventListener('click', closeCredentials);
    head.appendChild(close);
    box.appendChild(head);
    box.appendChild(el('div', 'emit-auth__list'));
    const foot = el('div', 'emit-auth__foot');
    const persisted = window.ui.getConfigs && window.ui.getConfigs().persistAuthorization;
    foot.appendChild(
      el('span', null, persisted ? 'Kept in this browser until you log out' : 'Kept on this page until it reloads'),
    );
    const doneButton = el('button', 'emit-quiet', 'Done');
    doneButton.type = 'button';
    doneButton.addEventListener('click', closeCredentials);
    foot.appendChild(doneButton);
    box.appendChild(foot);
    scrim.appendChild(box);
    scrim.addEventListener('click', function (event) {
      if (event.target === scrim) closeCredentials();
    });
    scrim.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeCredentials();
      /* A modal keeps Tab inside it: past the last control, back to the first. */
      if (event.key !== 'Tab') return;
      const stops = scrim.querySelectorAll('button, input');
      const first = stops[0],
        last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    });
    host.appendChild(scrim);
  }
  credentialsOpener = document.activeElement;
  scrim.hidden = false;
  scrim.dataset.signature = '';
  paintCredentials();
  /* The minutes to expiry count down while it is open. */
  credentialsTick = setInterval(paintCredentials, 30000);
  const first = scrim.querySelector('.emit-auth__input, .emit-auth__list button, .emit-quiet');
  if (first) first.focus();
}

function closeCredentials() {
  const scrim = document.getElementById('emit-auth');
  if (!scrim || scrim.hidden) return;
  scrim.hidden = true;
  clearInterval(credentialsTick);
  if (credentialsOpener && credentialsOpener.focus) credentialsOpener.focus();
}
