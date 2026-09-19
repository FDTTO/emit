// @widths 1280,375,320
// Page-wide layout invariants: nothing pushes the page
// sideways, the lifecycle figure fits its box and runs down on a phone, the
// topbar stays one row, and the executed request sits on the operation gutter
// with its wells drawn.
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 4000);

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
  check('topbar is one row', bar.height <= 32, bar);

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
  done();
}, 10500);
