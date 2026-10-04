// @widths 1280
// Each operation remembers its last few calls, in the page only: when,
// what came back, where it went and the body it sent, newest first, with
// one click to load a body into the editor again.
let calls = 0;
const realFetch = window.fetch;
window.fetch = function (url, init) {
  if (String(url).indexOf('/v1/auth/login') !== -1) {
    calls++;
    const ok = calls > 1;
    return Promise.resolve(new Response(JSON.stringify(ok ? { token: V.jwt(3600) } : { status: 401, message: 'Invalid credentials.', timestamp: new Date().toISOString() }),
      { status: ok ? 200 : 401, headers: { 'Content-Type': 'application/json' } }));
  }
  return realFetch.call(this, url, init);
};
const q = function (selector) { return document.querySelector('#operations-Authentication-login ' + selector); };
const area = function () { return q('textarea.body-param__text'); };
const setBody = function (text) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area(), text);
  area().dispatchEvent(new Event('input', { bubbles: true }));
};

V.until(function () { return !!V.definition('bearerAuth'); }, function () {
  V.execute('Authentication', 'login', '{"username": "admin", "password": "wrong"}', 300);
  V.until(function () { return !!q('.emit-history') && !q('.emit-history').hidden; }, function () {
    check('after a call the bar offers its history', /History1$/.test(q('.emit-history').textContent), q('.emit-history').textContent);
    q('.emit-tool--edit').click();
    setBody('{"username": "admin", "password": "admin123"}');
    q('button.execute').click();
    V.until(function () { return q('.emit-history').dataset.count === '2'; }, function () {
      q('.emit-history').click();
      const rows = document.querySelectorAll('#operations-Authentication-login .emit-history__row');
      check('it lists the calls newest first, each in its outcome tone',
            rows.length === 2 && rows[0].querySelector('.emit-history__status').classList.contains('is-ok')
            && rows[1].querySelector('.emit-history__status').classList.contains('is-bad'), rows.length);
      check('with where each went and the body it sent', /\/v1\/auth\/login/.test(rows[1].querySelector('.emit-history__url').textContent)
            && /"password": "wrong"/.test(rows[1].querySelector('.emit-history__body').textContent));
      rows[1].querySelector('.emit-history__load').click();
      V.until(function () { return /wrong/.test(area().value); }, function () {
        check('Load puts that body back in the editor and closes the list',
              /"password": "wrong"/.test(area().value) && !document.querySelector('.emit-history__panel'));
        check('nothing of it is stored in the browser', !/wrong/.test(JSON.stringify(Object.assign({}, localStorage, sessionStorage))));
        V.logoutHeld();
        done();
      }, 3000);
    }, 8000);
  }, 12000);
}, 20000);
