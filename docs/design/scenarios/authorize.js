// @widths 1280
// @alone
// The credentials dialog is Authorize as Execute uses it: each scheme's state
// first, where a credential came from and until when, the way to get a
// missing one, and pasting, logging out and closing that act on the store.
// It is modal: Tab stays inside and Escape hands focus back.
const card = function (index) {
  return document.querySelectorAll('#emit-auth .emit-auth__cred')[index];
};
const state = function (index) {
  const c = card(index);
  return c ? c.querySelector('.emit-auth__state').textContent : '';
};
const open = function () {
  const s = document.getElementById('emit-auth');
  return !!s && !s.hidden;
};
const capsule = function () {
  return document.getElementById('emit-topbar-auth');
};
const q = function (selector) {
  return document.querySelector('#emit-auth ' + selector);
};

V.until(
  function () {
    return !!V.definition('bearerAuth') && !!capsule();
  },
  function () {
    V.fakeResponse('/v1/auth/login', 'post', 200, { token: V.jwt(3500) }, '/v1/auth/login', {}, 108);
    V.until(
      function () {
        return !!V.held('bearerAuth');
      },
      function () {
        capsule().focus();
        capsule().click();
        V.until(open, opened, 3000);
      },
      5000,
    );
  },
  20000,
);

function opened() {
  const box = q('.emit-auth__box').getBoundingClientRect();
  check('the capsule opens the dialog, in view', box.width > 400 && box.top >= 0 && box.bottom <= innerHeight, {
    top: box.top,
    bottom: box.bottom,
  });
  check('focus moves into it', document.getElementById('emit-auth').contains(document.activeElement));
  q('.emit-auth__foot .emit-quiet').focus();
  /* Every Tab that reaches the page, when and from where: this check has
     failed now and then under a parallel suite, and its detail says which. */
  const pressed = performance.now();
  document.addEventListener(
    'keydown',
    function (event) {
      if (event.key === 'Tab')
        tabs.push(
          Math.round(performance.now() - pressed) +
            'ms from ' +
            (document.activeElement && document.activeElement.className),
        );
    },
    true,
  );
  V.press('Tab');
  V.until(
    function () {
      return document.activeElement !== q('.emit-auth__foot .emit-quiet');
    },
    cards,
    3000,
  );
}
const tabs = [];

function cards() {
  check('Tab past the last control comes back to the first', document.activeElement === q('.emit-auth__close'), {
    now: document.activeElement && document.activeElement.className,
    tabs: tabs,
    focused: document.hasFocus(),
  });
  check(
    'a credential from a response says where it came from and until when',
    /^Held, filled from Login/.test(state(0)) && /expires in (58|57|59) min/.test(state(0)),
    state(0),
  );
  check(
    'a missing one says how to get it',
    /^Not held/.test(state(1)) && card(1).querySelector('.emit-auth__source').textContent.trim() === 'Create a tenant',
    state(1),
  );

  card(1).querySelector('.emit-auth__input').value = 'emit_pasted_key_1234';
  card(1).querySelector('.emit-primary').click();
  V.until(
    function () {
      return V.held('apiKeyAuth') === 'emit_pasted_key_1234' && /^Held/.test(state(1));
    },
    pasted,
    3000,
  );
}

function pasted() {
  check('pasting a key authorizes it', capsule().dataset.state === 'ADMIN,TENANT', capsule().dataset.state);
  check(
    'and its card turns held, masked',
    /^Held$/.test(state(1)) && /emit_p .+1234/.test(card(1).querySelector('.emit-auth__value').textContent),
    card(1).querySelector('.emit-auth__value').textContent,
  );
  const eye = card(0).querySelector('.emit-auth__eye'),
    field = card(0).querySelector('.emit-auth__field');
  const before = eye.getBoundingClientRect().right;
  eye.click();
  check(
    'the eye keeps its place at the edge of the field when it shows the whole value',
    eye.getBoundingClientRect().right === before && field.getBoundingClientRect().right - before < 16,
    { before: before, after: eye.getBoundingClientRect().right },
  );
  card(0).querySelector('.emit-quiet').click();
  V.until(
    function () {
      return !V.held('bearerAuth') && /^Not held/.test(state(0));
    },
    loggedOut,
    3000,
  );
}

function loggedOut() {
  check('logging out empties the credential', capsule().dataset.state === 'TENANT', capsule().dataset.state);
  q('.emit-auth__box').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  V.until(
    function () {
      return !open();
    },
    function () {
      check('Escape closes it and focus returns to the capsule', !open() && document.activeElement === capsule());
      V.logoutHeld();
      done();
    },
    3000,
  );
}
