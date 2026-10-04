// @widths 1280,320
// A region that scrolls sideways can be reached and scrolled by keyboard: a
// tab stop with a label while it overflows, and no tab stop when it fits.
// The result's code wraps instead, and on a phone the Authentication table
// stacks a block per scope, so neither needs one.
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 3000);

const narrow = window.innerWidth < 600;
const stop = function (selector) {
  const n = document.querySelector('#swagger-ui ' + selector);
  return n && { tab: n.getAttribute('tabindex'), role: n.getAttribute('role'), label: n.getAttribute('aria-label') };
};

V.until(function () { return !!document.querySelector('#operations-Authentication-login .emit-result'); }, function () {
  document.querySelector('#operations-Authentication-login .emit-result [data-tab="curl"]').click();
  setTimeout(function () {
    const frame = document.querySelector('#swagger-ui .emit-matrix-frame');
    const curl = document.querySelector('#operations-Authentication-login .emit-result__panel:not([hidden]) > .emit-well');
    if (narrow) {
      check('the Authentication table fits the width it has, so it is no tab stop',
            !!frame && frame.scrollWidth <= frame.clientWidth + 1 && stop('.emit-matrix-frame').tab === null,
            frame && { scroll: frame.scrollWidth, client: frame.clientWidth, stop: stop('.emit-matrix-frame') });
      check('the curl command wraps to the width it has', !!curl && curl.scrollWidth <= curl.clientWidth + 1,
            curl && { scroll: curl.scrollWidth, client: curl.clientWidth });
    } else {
      check('nothing that fits gains a tab stop',
            document.querySelectorAll('#swagger-ui [data-emit-scroller]').length === 0,
            document.querySelectorAll('#swagger-ui [data-emit-scroller]').length);
    }
    done();
  }, 600);
}, 20000);
