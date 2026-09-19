// @widths 1280
// @wait 34000
// Walking the page with real Tab presses. Each control the
// keyboard reaches must show where focus is, and focus must never change a
// control's shape. Unfocused styles are recorded first, so a focused control
// is compared with itself, not with a neighbour. Real keys matter: Chromium
// shows :focus-visible only after trusted keyboard input.
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 4000);

var PROPS = ['borderTopLeftRadius', 'outlineStyle', 'outlineWidth', 'boxShadow', 'borderTopColor', 'backgroundColor', 'color'];
var snap = function (e) { var cs = getComputedStyle(e), o = {}; PROPS.forEach(function (p) { o[p] = cs[p]; }); return o; };
var label = function (e) {
  return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '')
    + ' "' + (e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 20) + '"';
};

var resting = new Map();
var reached = [], silent = [], reshaped = [], notVisible = [], compared = 0, indicators = {};
var steps = 0;

var last = null;

/* A key is delivered by the runner's polling loop, so focus can still be on
   the previous control when this looks. Waiting for it to move (up to a
   second) keeps a slow key from reading as the end of the page. */
function step() {
  V.press('Tab');
  settle(0);
}

function settle(tries) {
  if (document.activeElement === last && tries < 10) return setTimeout(function () { settle(tries + 1); }, 100);
  inspect();
}

function inspect() {
  var e = document.activeElement;
  steps++;
  // The first presses can land before the page has the window's focus.
  if ((!e || e === document.body) && steps <= 3) return step();
  if (!e || e === document.body || reached.indexOf(e) >= 0 || steps > 140) return finish();
  reached.push(e);
  last = e;
  var before = resting.get(e);
  var after = snap(e);
  if (!e.matches(':focus-visible')) notVisible.push(label(e));
  if (before) {
    var outlined = after.outlineStyle !== 'none' && after.outlineWidth !== '0px';
    // Only what reads as a focus indicator counts: a ring, a shadow, an edge
    // or a fill. A text colour shift alone is too faint to find focus by.
    var moved = ['boxShadow', 'borderTopColor', 'backgroundColor'].filter(function (p) { return before[p] !== after[p]; });
    var changed = moved.length > 0;
    compared++;
    var how = outlined ? 'outline' : moved.join('+') || 'nothing';
    indicators[how] = (indicators[how] || 0) + 1;
    if (!outlined && !changed) silent.push(label(e));
    var cs = getComputedStyle(e);
    var edge = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.borderBottomWidth !== '0px';
    if (edge && before.borderTopLeftRadius !== after.borderTopLeftRadius) reshaped.push(label(e));
  }
  step();
}

function finish() {
  check('the keyboard reaches the page\'s controls', reached.length >= 30, reached.length);
  // Without this the checks below could pass by comparing nothing: a control
  // React re-rendered after the resting snapshot has no snapshot to compare.
  check('almost every control reached was compared', compared >= reached.length * 0.9, { compared: compared, reached: reached.length });
  L('indicators', indicators);
  check('every control reached is in :focus-visible', notVisible.length === 0, notVisible.slice(0, 6));
  check('every control reached shows focus', silent.length === 0, silent.slice(0, 6));
  check('focus never reshapes a control', reshaped.length === 0, reshaped.slice(0, 6));
  L('reached', reached.length);
  done();
}

setTimeout(function () {
  document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]').forEach(function (e) { resting.set(e, snap(e)); });
  if (document.activeElement) document.activeElement.blur();
  last = document.activeElement;
  step();
}, 10500);
