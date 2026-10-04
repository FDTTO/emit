// @widths 1280
// The statusbar's server light is live: green while the API answers
// healthy, amber and "not answering" while it does not answer, amber and
// "not healthy" while it answers that a part of it is down, with which part
// on hover. It checks again as soon as the reader comes back to the page.
let mode = 'up';
const realFetch = window.fetch;
window.fetch = function (url, init) {
  if (String(url).indexOf('/actuator/health') !== -1) {
    if (mode === 'down') return Promise.reject(new TypeError('Failed to fetch'));
    if (mode === 'unwell') {
      return Promise.resolve(new Response(JSON.stringify({ status: 'DOWN', components: { db: { status: 'UP' }, kafka: { status: 'DOWN' } } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
  }
  return realFetch.call(this, url, init);
};
allowErrors(/Failed to fetch|503/);
const server = function () { return document.getElementById('emit-status-server'); };
const led = function () { return getComputedStyle(server().querySelector('.emit-status__led')).backgroundColor; };
const comeBack = function () { document.dispatchEvent(new Event('visibilitychange')); };

V.until(function () { return server() && server().dataset.state === 'up'; }, function () {
  const green = led();
  check('a healthy API keeps the light green, with no words', server().querySelector('.emit-status__health').textContent === '');
  mode = 'down';
  comeBack();
  V.until(function () { return server().dataset.state === 'down'; }, function () {
    check('an API that does not answer turns it amber, saying so',
          /not answering/.test(server().textContent) && led() !== green && /no answer at http/.test(server().title), server().title);
    mode = 'unwell';
    comeBack();
    V.until(function () { return server().dataset.state === 'unwell'; }, function () {
      check('one that answers with a part down says which, on hover',
            /not healthy/.test(server().textContent) && server().title === 'The API: kafka down', server().title);
      mode = 'up';
      comeBack();
      V.until(function () { return server().dataset.state === 'up'; }, function () {
        check('and it turns green again when the API is back', led() === green && server().title === '');
        done();
      }, 5000);
    }, 5000);
  }, 5000);
}, 20000);
