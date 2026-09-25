// @widths 1280,375,320
// Page-wide layout invariants: nothing pushes the page
// sideways, the lifecycle figure fits its box and runs down on a phone, the
// topbar stays one row, and the executed request's result sits on the
// operation gutter with its wells drawn, and no open operation clips what it
// holds.
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 4000);
V.open('Documents', 'getDocument', 6000);
V.open('Tenants', 'createTenant', 7500);

// An operation hides its overflow, so anything wider than it is cut off
// unless a scroller between them lets the reader reach it.
function clipped(op) {
  var edge = op.getBoundingClientRect().right + 1, found = null;
  op.querySelectorAll('*').forEach(function (n) {
    var r = n.getBoundingClientRect();
    if (found || !r.width || r.right <= edge) return;
    for (var p = n.parentElement; p && p !== op; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return;
    }
    found = n.tagName + '.' + String(n.className).slice(0, 40) + ' to ' + Math.round(r.right);
  });
  return found;
}

setTimeout(function () {
  var root = document.documentElement, width = root.clientWidth;
  check('no sideways scroll', root.scrollWidth <= width, { scrollWidth: root.scrollWidth, width: width });

  var flow = document.querySelector('.emit-flow'), box = flow.getBoundingClientRect();
  var inside = Array.prototype.every.call(document.querySelectorAll('.emit-flow-node'), function (n) {
    var r = n.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right;
  });
  var direction = getComputedStyle(flow).flexDirection;
  check('lifecycle nodes all inside their box', inside);
  check('lifecycle runs down on a phone, across on a desktop', direction === (width < 600 ? 'column' : 'row'), direction);

  var bar = V.box('.topbar .topbar-wrapper');
  var rows = Array.prototype.map.call(document.querySelector('.topbar .topbar-wrapper').children, function (c) {
    var r = c.getBoundingClientRect(); return r.height ? Math.round(r.top + r.height / 2) : null;
  }).filter(function (y) { return y !== null; });
  check('topbar is one row', rows.every(function (y) { return Math.abs(y - rows[0]) <= 2; }) && bar.height <= 56, { bar: bar, centres: rows });

  var body = document.querySelector('#operations-Authentication-login .opblock-body').getBoundingClientRect();
  var gutter = Math.round(body.left) + parseInt(getComputedStyle(root).getPropertyValue('--gutter'), 10);
  ['.emit-sent', '.emit-note', '.emit-result'].forEach(function (s) {
    var r = document.querySelector('#operations-Authentication-login ' + s).getBoundingClientRect();
    check('on the gutter: ' + s, Math.round(r.left) === gutter, { left: Math.round(r.left), gutter: gutter });
  });
  ['.emit-sent', '.emit-result__panel:not([hidden]) > .emit-well'].forEach(function (s) {
    var cs = getComputedStyle(document.querySelector('#operations-Authentication-login ' + s));
    check('well drawn: ' + s, cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.boxShadow !== 'none');
  });
  var stock = document.querySelector('#operations-Authentication-login .curl-command');
  check('the stock live blocks are out of sight', !!stock && !stock.getClientRects().length);
  if (width < 900) {
    var rail = document.getElementById('emit-rail');
    check('a phone keeps the rail as a closed drawer', getComputedStyle(rail).visibility === 'hidden' && rail.getBoundingClientRect().right <= 0);
    var strip = document.getElementById('emit-strip');
    check('the next step rides under the bar', !!strip && strip.getBoundingClientRect().height > 0 && /NEXT/.test(strip.textContent), strip && strip.textContent);
    check('the topbar keeps to menu, brand and credentials', getComputedStyle(document.getElementById('emit-crumb')).display === 'none'
          && document.getElementById('emit-menu').getBoundingClientRect().width > 0);
    check('the legend waits in the foot of the drawer', rail.contains(document.getElementById('emit-legend-btn')));
  }
  var tenant = document.getElementById('operations-Tenants-createTenant');
  var execute = tenant && tenant.querySelector('button.execute');
  var cancel = tenant && tenant.querySelector('.try-out__btn.cancel');
  check('an opened operation is ready to execute', !!execute && execute.getBoundingClientRect().height > 0
    && (!cancel || cancel.getBoundingClientRect().height === 0));
  ['Authentication-login', 'Documents-getDocument', 'Tenants-createTenant'].forEach(function (id) {
    var op = document.getElementById('operations-' + id), cut = op && clipped(op);
    check('nothing clipped: ' + id, !!op && !cut, cut);
  });
  if (width >= 900) return done();
  document.getElementById('emit-menu').click();
  V.until(function () { var rail = document.getElementById('emit-rail'); return rail.getBoundingClientRect().left >= 0 && rail.contains(document.activeElement); }, function () {
    var rail = document.getElementById('emit-rail').getBoundingClientRect();
    check('the menu opens the drawer, focus inside', rail.left >= 0 && rail.width > 200
          && document.getElementById('emit-rail').contains(document.activeElement), { left: rail.left, width: rail.width });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    V.until(function () { return document.getElementById('emit-window').dataset.drawer !== 'open'; }, function () {
      check('Escape closes it, focus back on the menu', document.activeElement === document.getElementById('emit-menu'));
      done();
    }, 3000);
  }, 3000);
}, 10500);
