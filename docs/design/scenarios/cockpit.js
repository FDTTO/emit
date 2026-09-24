// @widths 1280
// The cockpit shell: the page itself never scrolls, the content pane does;
// the rail's map lists every operation the spec has; choosing one opens it,
// and both the map and the titlebar then say that is where the reader is.
var pane = function () { return document.querySelector('#emit-window .swagger-container > .swagger-ui'); };
var link = function (id) { return document.querySelector('.emit-map__item[data-target="operations-Documents-' + id + '"]'); };

V.until(function () { return !!link('requestDocumentGeneration') && !!pane() && !!document.querySelector('.opblock'); }, function () {
  var root = document.scrollingElement;
  check('the page does not scroll', root.scrollHeight <= innerHeight + 1, { page: root.scrollHeight, viewport: innerHeight });
  check('the content pane does', pane().scrollHeight > pane().clientHeight, { content: pane().scrollHeight, pane: pane().clientHeight });

  var operations = 0;
  Object.keys(window.ui.specSelectors.specJson().toJS().paths).forEach(function (path) {
    operations += Object.keys(window.ui.specSelectors.specJson().toJS().paths[path]).length;
  });
  var items = document.querySelectorAll('.emit-map__item:not(.emit-map__item--overview)').length;
  check('the map lists every operation', items === operations, { map: items, spec: operations });
  check('at the top, the overview is current', !!document.querySelector('.emit-map__item--overview.is-current'));

  link('requestDocumentGeneration').click();
  V.until(function () {
    var block = document.getElementById('operations-Documents-requestDocumentGeneration');
    return block && block.classList.contains('is-open') && link('requestDocumentGeneration').classList.contains('is-current');
  }, function () {
    check('choosing it opens the operation', document.getElementById('operations-Documents-requestDocumentGeneration').classList.contains('is-open'));
    check('the map marks it current', link('requestDocumentGeneration').classList.contains('is-current'));
    var block = document.getElementById('operations-Documents-requestDocumentGeneration');
    L('landing', { scrollTop: Math.round(pane().scrollTop), paneTop: Math.round(pane().getBoundingClientRect().top),
      blockTop: Math.round(block.getBoundingClientRect().top), maxScroll: pane().scrollHeight - pane().clientHeight });
    var crumb = document.getElementById('emit-crumb').textContent;
    check('the titlebar names it', /POST \/v1\/documents\/\{id\}\/generate/.test(crumb), crumb);
    done();
  }, 15000);
}, 20000);
