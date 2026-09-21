// @widths 1280,375
// The topbar credential tag in every state, one 30px row inside the bar, and
// a click that opens a dialog the reader can actually see. Each step waits
// for the state it checks, not for a clock.
var tag = function () { return document.getElementById('emit-topbar-auth'); };
var state = function () { return tag().dataset.state; };
var height = function () { return V.box('#emit-topbar-auth').height; };
var isOpen = function (id) { var b = document.getElementById(id); return !!b && b.classList.contains('is-open'); };
var reaches = function (expected) { return function () { return state() === expected; }; };

V.until(function () { return !!tag() && !!V.definition('bearerAuth'); }, function () {
  check('empty: an invitation to authorize', state() === '' && /Authorize/.test(tag().textContent), state());
  check('empty: 30px tall', height() === 30, height());
  V.authorize('bearerAuth', V.jwt(3600));
  V.until(reaches('ADMIN'), admin);
}, 20000);

function admin() {
  check('admin token: ADMIN', state() === 'ADMIN', state());
  V.authorize('apiKeyAuth', 'key');
  V.until(reaches('ADMIN,TENANT'), both);
}

function both() {
  var bar = V.box('.topbar'), box = V.box('#emit-topbar-auth');
  check('both: ADMIN,TENANT', state() === 'ADMIN,TENANT', state());
  check('both: still 30px', height() === 30, height());
  check('tag sits inside the bar', box.top >= bar.top && box.top + box.height <= bar.top + bar.height, { bar: bar, tag: box });
  V.logoutHeld();
  V.authorize('bearerAuth', V.jwt(-60));
  V.until(reaches('EXPIRED'), expired);
}

function expired() {
  check('expired token: EXPIRED, flagged', state() === 'EXPIRED' && /expired/i.test(tag().textContent), state());
  tag().click();
  V.until(function () { return isOpen('operations-Authentication-login'); }, function () {
    check('holding only an expired token, the click leads to login', isOpen('operations-Authentication-login'));
    V.logoutHeld();
    V.until(reaches(''), dialog);
  });
}

function dialog() {
  tag().click();
  var visible = function () {
    var box = document.querySelector('.dialog-ux .modal-ux');
    var r = box && box.getBoundingClientRect();
    return r && r.width > 200 && r.height > 100 ? { box: box, r: r } : null;
  };
  V.until(visible, function () {
    var found = visible();
    var hit = found && document.elementFromPoint(found.r.left + found.r.width / 2, found.r.top + Math.min(40, found.r.height / 2));
    check('click opens a visible dialog', !!found && found.box.contains(hit),
          found ? { width: Math.round(found.r.width), height: Math.round(found.r.height) } : 'no dialog');
    done();
  });
}
