// @widths 1280
// An operation opened for the first time is resolved before it can run, and
// Swagger draws its action bar meanwhile. Held in that moment, the bar is a
// ghost of itself: the same height, nothing in it to press, the shapes of
// what it will hold, under the placeholder of what comes above it.
const block = function () { return document.getElementById('operations-Documents-createDocument'); };
const bar = function () { return block().querySelector('.opblock-body > :is(.execute-wrapper, .btn-group)'); };

V.until(function () { return !!block() && !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  window.ui.specActions.requestResolvedSubtree = function () {};
  V.open('Documents', 'createDocument', 0);
  V.until(function () { return !!block().querySelector('.opblock-loading-animation') && !!bar(); }, function () {
    const execute = bar().querySelector('button.execute');
    check('resolving, Execute is not there to press', !execute || getComputedStyle(execute).visibility === 'hidden',
          execute && getComputedStyle(execute).visibility);
    check('the bar holds the shape of what it sends and of Execute',
          getComputedStyle(bar(), '::before').content !== 'none' && getComputedStyle(bar(), '::after').content !== 'none');
    const body = block().querySelector('.opblock-body');
    const placeholder = parseFloat(getComputedStyle(body, '::after').height);
    check('the placeholder of the fields sits above the bar, where the fields will be',
          placeholder > 0 && Number(getComputedStyle(bar()).order) > 0, { order: getComputedStyle(bar()).order });
    done();
  }, 8000);
}, 20000);
