// @widths 1280,320
// A region that scrolls sideways can be reached and scrolled by keyboard: a
// tab stop with a label while it overflows, and no tab stop when it fits.
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 3000);

var narrow = window.innerWidth < 600;
var stop = function (selector) {
  var n = document.querySelector('#swagger-ui ' + selector);
  return n && { tab: n.getAttribute('tabindex'), role: n.getAttribute('role'), label: n.getAttribute('aria-label') };
};

V.until(function () { return !!document.querySelector('#operations-Authentication-login pre.curl'); }, function () {
  setTimeout(function () {
    var matrix = stop('.emit-matrix-frame');
    var curl = stop('pre.curl');
    if (narrow) {
      check('the Authentication table is a labelled tab stop',
            !!matrix && matrix.tab === '0' && matrix.role === 'region' && /Authentication table/.test(matrix.label || ''), matrix);
      check('the curl command is a labelled tab stop',
            !!curl && curl.tab === '0' && /curl command/.test(curl.label || ''), curl);
    } else {
      check('nothing that fits gains a tab stop',
            document.querySelectorAll('#swagger-ui [data-emit-scroller]').length === 0,
            document.querySelectorAll('#swagger-ui [data-emit-scroller]').length);
    }
    done();
  }, 600);
}, 20000);
