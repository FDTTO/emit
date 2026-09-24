// @widths 1280,375,320
// Page-wide layout invariants: nothing pushes the page
// sideways, the lifecycle figure fits its box and runs down on a phone, the
// topbar stays one row, and the executed request sits on the operation gutter
// with its wells drawn, and no open operation clips what it holds.
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
  ['.curl-command > h4', '.curl-command > div:last-child', '.request-url > h4', '.request-url pre'].forEach(function (s) {
    var r = document.querySelector('#operations-Authentication-login ' + s).getBoundingClientRect();
    check('on the gutter: ' + s, Math.round(r.left) === gutter, { left: Math.round(r.left), gutter: gutter });
  });
  ['.curl-command > div:last-child', '.request-url pre'].forEach(function (s) {
    var cs = getComputedStyle(document.querySelector('#operations-Authentication-login ' + s));
    check('well drawn: ' + s, cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.borderTopWidth !== '0px');
  });
  if (width < 900) {
    check('a phone shows no rail', getComputedStyle(document.getElementById('emit-rail')).display === 'none');
    var legend = document.getElementById('emit-legend-btn').getBoundingClientRect();
    check('the legend stays a small corner control', legend.height < 60 && legend.width < 60,
          { width: Math.round(legend.width), height: Math.round(legend.height) });
    check('the topbar keeps to brand and credentials', getComputedStyle(document.getElementById('emit-crumb')).display === 'none');
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
  done();
}, 10500);
