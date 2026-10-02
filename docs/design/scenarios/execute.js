// @widths 1280
// Execute closes each request on an action bar that says what the call
// sends: no credential, one that is held, or one that is missing, with the
// way to get it. While the request runs past the bottom of the view the bar
// docks there; while the call is out it counts the time and the button stays
// alive; Ctrl+Enter sends the operation being worked on.
var realFetch = window.fetch;
window.fetch = function (url) {
  var args = arguments, self = this;
  if (String(url).indexOf('/v1/auth/login') !== -1) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(realFetch.apply(self, args)); }, 2500); });
  }
  return realFetch.apply(this, arguments);
};
var pane = function () { return document.querySelector('#emit-window .swagger-container > .swagger-ui'); };
var sends = function (id) { return document.querySelector('#operations-' + id + ' .emit-sends'); };
var bar = function (id) { return document.querySelector('#operations-' + id + ' .opblock-body > :is(.execute-wrapper, .btn-group)'); };

V.open('Authentication', 'login', 1500);
V.open('Documents', 'createDocument', 1800);
V.until(function () { return !!sends('Authentication-login') && !!sends('Documents-createDocument'); }, function () {
  check('an open route sends no credential', sends('Authentication-login').textContent === 'Sends no credential');
  var missing = sends('Documents-createDocument');
  check('a guarded one names its header, says it is missing and offers Authorize',
        missing.dataset.state === 'missing' && /^X-API-Key not held/.test(missing.textContent) && !!missing.querySelector('button'),
        missing.textContent);
  V.authorize('apiKeyAuth', 'emit_scenario_key');
  V.until(function () { return sends('Documents-createDocument').dataset.state === 'held'; }, function () {
    check('and says it is held once it is', sends('Documents-createDocument').textContent === 'X-API-Key held');
    V.logoutHeld();
    docking();
  }, 3000);
}, 20000);

function docking() {
  document.getElementById('emit-window').style.height = '380px';
  var block = document.getElementById('operations-Documents-createDocument');
  pane().scrollTop += block.getBoundingClientRect().top - pane().getBoundingClientRect().bottom + 120;
  var early = bar('Documents-createDocument');
  var above = early.previousElementSibling.getBoundingClientRect().bottom;
  check('an operation just coming into view keeps its bar in place, off its request',
        !early.hasAttribute('data-emit-dockable') && early.getBoundingClientRect().top >= above - 1,
        { bar: early.getBoundingClientRect().top, above: above });
  pane().scrollTop += block.getBoundingClientRect().top - pane().getBoundingClientRect().top;
  /* The docked mark can still be the last paint's; what counts is the bar
     on the edge after this scroll. */
  var onEdge = function () {
    var docked = bar('Documents-createDocument');
    return docked.hasAttribute('data-emit-docked') && Math.abs(docked.getBoundingClientRect().bottom - pane().getBoundingClientRect().bottom) < 1;
  };
  V.until(onEdge, function () {
    var box = bar('Documents-createDocument').getBoundingClientRect();
    check('a request running past the view docks its bar on the bottom edge',
          Math.abs(box.bottom - pane().getBoundingClientRect().bottom) < 1, { bar: box.bottom, pane: pane().getBoundingClientRect().bottom });
    document.getElementById('emit-window').style.height = '';
    running();
  }, 3000);
}

function running() {
  var login = document.getElementById('operations-Authentication-login');
  login.querySelector('textarea').focus();
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  V.until(function () { return sends('Authentication-login').dataset.state === 'running'; }, function () {
    var button = login.querySelector('button.execute');
    check('Ctrl+Enter sends the operation holding focus', button.disabled);
    check('while the call is out the bar counts its time', /^Running · \d+ ms$/.test(sends('Authentication-login').textContent),
          sends('Authentication-login').textContent);
    check('and the button stays lit', getComputedStyle(button).opacity === '1');
    V.until(function () { return !login.querySelector('button.execute').disabled; }, function () {
      check('the count ends with the call', sends('Authentication-login').textContent === 'Sends no credential');
      var again = login.querySelector('button.execute');
      check('with the answer shown, Execute stays at hand to send it again', !!again && again.getBoundingClientRect().height > 0);
      V.logoutHeld();
      done();
    }, 8000);
  }, 3000);
}
