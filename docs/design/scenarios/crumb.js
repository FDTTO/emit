// @widths 1280
// The titlebar names where the reader is. Scrolled past a section's heading
// and short of its first operation, that is the section, not the last
// operation of the section above.
var pane = function () { return document.querySelector('#emit-window .swagger-container > .swagger-ui'); };
var crumb = function () { return document.getElementById('emit-crumb').textContent; };

V.until(function () { return !!document.querySelector('h3.opblock-tag[data-tag="Documents"]') && !!document.querySelector('.opblock'); }, function () {
  var heading = document.querySelector('h3.opblock-tag[data-tag="Documents"]');
  /* The place is read on a line 64px under the pane's top: the heading just
     past it, its first operation still below. */
  var top = pane().getBoundingClientRect().top;
  pane().scrollTop += heading.getBoundingClientRect().top - top - 60;
  V.until(function () { return crumb() === 'Documents'; }, function () {
    check('past a section heading, the titlebar names the section', crumb() === 'Documents', crumb());
    var first = heading.closest('.opblock-tag-section').querySelector('.opblock');
    pane().scrollTop += first.getBoundingClientRect().top - pane().getBoundingClientRect().top - 20;
    V.until(function () { return /\/v1\/documents/.test(crumb()); }, function () {
      check('past its first operation, it names the operation', /^Documents\/GET \/v1\/documents$/.test(crumb()), crumb());
      done();
    }, 3000);
  }, 3000);
}, 20000);
