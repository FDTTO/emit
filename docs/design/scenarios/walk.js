// @widths 1280
// @alone
// J and K walk the operations from the first in view, focus on each row's
// own button so Enter opens it; typing in a field or a dialog being open
// leaves the letters alone.
var press = function (key, target) { (target || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true })); };
var current = function () { var b = document.activeElement && document.activeElement.closest('.opblock'); return b ? b.id : null; };

V.until(function () { return !!document.querySelector('.opblock .opblock-summary-control') && !document.getElementById('emit-window').hasAttribute('data-loading'); }, function () {
  document.activeElement.blur();
  press('j');
  check('J lands on the first operation in view', current() === 'operations-Authentication-login', current());
  press('j');
  press('j');
  check('and walks on to the next', current() === 'operations-Documents-createDocument', current());
  press('k');
  check('K walks back', current() === 'operations-Documents-listDocuments', current());
  var row = document.activeElement.closest('.opblock').getBoundingClientRect();
  check('the row it lands on is in view', row.top >= 0 && row.bottom <= innerHeight, { top: row.top, bottom: row.bottom });
  V.press('Enter');
  /* Open is not enough: an operation opened the first time is still being
     resolved, and its fields come after. */
  var pageField = function () { return document.querySelector('#operations-Documents-listDocuments tr[data-param-name="page"] input'); };
  V.until(function () { return !!pageField(); }, function () {
    check('Enter opens the operation it is on', !!document.querySelector('#operations-Documents-listDocuments.is-open'));
    var field = pageField();
    field.focus();
    press('j', field);
    check('typing in a field keeps its letters', document.activeElement === field);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    var input = document.querySelector('.emit-palette__input');
    press('j', document.body);
    check('with a dialog open the letters do nothing', document.activeElement === input || current() === null);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    done();
  }, 5000);
}, 20000);
