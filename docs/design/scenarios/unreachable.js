// @widths 1280
// A call that gets no answer at all, the API down or the connection refused,
// has no status. The console says so in words and where it tried, and reads
// it as wait, then retry, on the result, the row, the map and the statusbar;
// nothing shows "undefined" or dresses the silence as a success.
var realFetch = window.fetch;
window.fetch = function (url) {
  if (String(url).indexOf('/v1/auth/login') !== -1) return Promise.reject(new TypeError('Failed to fetch'));
  return realFetch.apply(this, arguments);
};
allowErrors(/Failed to fetch/);
var q = function (selector) { return document.querySelector('#operations-Authentication-login ' + selector); };

V.until(function () { return !!V.definition('bearerAuth'); }, function () {
  V.execute('Authentication', 'login', null, 300);
  V.until(function () { return !!q('.emit-result__status'); }, function () {
    var status = q('.emit-result__status');
    check('the result says no answer came, in the wait-then-retry tone',
          status.textContent === 'No answer' && status.classList.contains('emit-result__status--wait'), status.className + ' ' + status.textContent);
    check('and in words where it tried and what to do', /did not answer.*at http.*Start it and Execute again/.test(q('.emit-result .emit-well').textContent),
          q('.emit-result .emit-well').textContent);
    check('the row, the map and the statusbar agree',
          q('.emit-last').textContent === 'No answer' && q('.emit-last').classList.contains('is-wait')
          && document.querySelector('.emit-map__item[data-target="operations-Authentication-login"] .emit-map__ran').classList.contains('is-wait')
          && document.getElementById('emit-status-last').textContent === 'Last no answer');
    check('and nothing reads "undefined"', !/undefined/.test(document.getElementById('emit-window').textContent));
    done();
  }, 10000);
}, 20000);
