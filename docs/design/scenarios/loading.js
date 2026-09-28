// @widths 1280
// The placeholders hold the window until what comes with the description is
// in, never what a reader opens: with every section folded no operation is
// in the DOM, and the page must still arrive. A font host that never
// answers holds it no longer than the faces' own ceiling.
window.scenarioConfig = { docExpansion: 'none' };
document.fonts.load = function () { return new Promise(function () {}); };
var win = function () { return document.getElementById('emit-window'); };
var loading = function () { return !!win() && win().hasAttribute('data-loading'); };

V.until(function () { return !!document.querySelector('.emit-skel'); }, function () {
  check('placeholders hold the window while it loads', loading() && !!document.querySelector('.emit-skel--main'));
  var seen = Date.now();
  V.until(function () { return !loading(); }, function () {
    var waited = Date.now() - seen;
    check('with every section folded, the page still arrives',
          !loading() && !document.querySelector('.opblock') && !!document.querySelector('h3.opblock-tag[data-is-open="false"]'));
    check('a font host that never answers holds it only to the faces ceiling', !loading() && waited < 4000, waited);
    done();
  }, 10000);
}, 10000);
