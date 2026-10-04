// @widths 1280
// The placeholders hold the window until what comes with the description is
// in, never what a reader opens: with every section folded no operation is
// in the DOM, and the page must still arrive. A font host that never
// answers holds it no longer than the faces' own ceiling.
window.scenarioConfig = { docExpansion: 'none' };
document.fonts.load = function () { return new Promise(function () {}); };
const win = function () { return document.getElementById('emit-window'); };
const loading = function () { return !!win() && win().hasAttribute('data-loading'); };

V.until(function () { return !!document.querySelector('.emit-skel'); }, function () {
  check('placeholders hold the window while it loads', loading() && !!document.querySelector('.emit-skel--main'));
  check('the figure placeholder boots through the three stages of the lifecycle',
        document.querySelectorAll('.emit-skel__figure .emit-skel__node').length === 3);
  const seen = Date.now();
  V.until(function () { return !loading(); }, function () {
    const waited = Date.now() - seen;
    check('with every section folded, the page still arrives',
          !loading() && !document.querySelector('.opblock') && !!document.querySelector('h3.opblock-tag[data-is-open="false"]'));
    /* Between the faces' 2.5 s and the page's 8 s ceiling: only the first can
       release it this early, however slow the rest of the render runs. */
    check('a font host that never answers holds it only to the faces ceiling', !loading() && waited < 6000, waited);
    done();
  }, 10000);
}, 10000);
