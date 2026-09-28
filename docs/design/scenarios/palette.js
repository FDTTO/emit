// @widths 1280
// Ctrl+K is one field for everything: operations to land on and actions to
// run, each group labelled, each action saying what it would do now. Typing
// narrows both; Enter runs the chosen one.
var box = function () { return document.querySelector('.emit-palette'); };
var input = function () { return document.querySelector('.emit-palette__input'); };
var names = function () { return Array.prototype.map.call(document.querySelectorAll('.emit-palette__item .emit-palette__name'), function (n) { return n.textContent; }); };
var open = function () { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); };
var type = function (text) { input().value = text; input().dispatchEvent(new Event('input', { bubbles: true })); };
var enter = function () { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };

try { localStorage.removeItem('emit.density'); } catch (ignored) { /* private mode */ }
V.until(function () { return !!document.querySelector('.emit-map__item') && !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  open();
  var groups = Array.prototype.map.call(document.querySelectorAll('.emit-palette__group'), function (g) { return g.textContent; });
  check('it lists actions and operations, each under its label', !box().hidden && groups.join() === 'Actions,Operations', groups);
  check('actions say what they would do now', names().indexOf('Compact layout') !== -1 && names().indexOf('Open all in Tenants') !== -1, names().slice(0, 8));
  type('compact');
  enter();
  check('an action runs from it', document.documentElement.dataset.density === 'compact' && box().hidden);
  open();
  check('and reads afresh next time', names().indexOf('Comfortable layout') !== -1);
  type('comfortable');
  enter();
  open();
  type('open all in tenants');
  enter();
  V.until(function () { return document.querySelectorAll('[id^="operations-Tenants-"].is-open').length === 5; }, function () {
    check('a section opens all its operations from it', document.querySelectorAll('[id^="operations-Tenants-"].is-open').length === 5);
    open();
    type('zzqq');
    check('nothing matching says so', !!document.querySelector('.emit-palette__empty'));
    type('create doc');
    check('typing narrows to what matches', names().join() === 'Create document', names());
    enter();
    V.until(function () { return !!document.querySelector('#operations-Documents-createDocument.is-open'); }, function () {
      check('Enter lands on the operation', !!document.querySelector('#operations-Documents-createDocument.is-open'));
      try { localStorage.removeItem('emit.density'); } catch (ignored) { /* private mode */ }
      done();
    }, 5000);
  }, 5000);
}, 20000);
