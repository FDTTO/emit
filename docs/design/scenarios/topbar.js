// @widths 1280,375
// The topbar credential tag in every state, one 30px row inside the bar, and
// a click that opens a dialog the reader can actually see.
var tag = function () { return document.getElementById('emit-topbar-auth'); };
var state = function () { return tag().dataset.state; };
var height = function () { return V.box('#emit-topbar-auth').height; };

setTimeout(function () {
  check('empty: an invitation to authorize', state() === '' && /Authorize/.test(tag().textContent), state());
  check('empty: 30px tall', height() === 30, height());
  V.authorize('bearerAuth', V.jwt(3600));
}, 4000);

setTimeout(function () {
  check('admin token: ADMIN', state() === 'ADMIN', state());
  V.authorize('apiKeyAuth', 'key');
}, 4500);

setTimeout(function () {
  var bar = V.box('.topbar'), box = V.box('#emit-topbar-auth');
  check('both: ADMIN,TENANT', state() === 'ADMIN,TENANT', state());
  check('both: still 30px', height() === 30, height());
  check('tag sits inside the bar', box.top >= bar.top && box.top + box.height <= bar.top + bar.height, { bar: bar, tag: box });
  V.logoutHeld();
  V.authorize('bearerAuth', V.jwt(-60));
}, 5000);

setTimeout(function () {
  check('expired token: EXPIRED, flagged', state() === 'EXPIRED' && /expired/i.test(tag().textContent), state());
  tag().click();
}, 5500);

setTimeout(function () {
  var login = document.getElementById('operations-Authentication-login');
  check('holding only an expired token, the click leads to login', !!login && login.classList.contains('is-open'));
  V.logoutHeld();
  tag().click();
}, 6700);

setTimeout(function () {
  var dialog = document.querySelector('.dialog-ux .modal-ux');
  var r = dialog && dialog.getBoundingClientRect();
  var hit = r && document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(40, r.height / 2));
  check('click opens a visible dialog', !!r && r.width > 200 && r.height > 100 && dialog.contains(hit),
        r ? { width: Math.round(r.width), height: Math.round(r.height) } : 'no dialog');
  done();
}, 8200);
