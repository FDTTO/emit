// @widths 375
// On a phone a run floats as a pill over the page, with its id, its stages
// and the state it is in, and each operation row keeps to method, path, the
// last answer and the scope glyph.
const id = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20';
const pill = function () {
  return document.getElementById('emit-live-pill');
};
const seen = function (node) {
  return !!node && node.getClientRects().length > 0;
};

V.until(
  function () {
    return !!V.definition('apiKeyAuth') && !!document.querySelector('.emit-map__item');
  },
  function () {
    V.authorize('apiKeyAuth', 'key');
    const realFetch = window.fetch;
    window.fetch = function (url, init) {
      if (String(url).indexOf('/v1/documents/' + id) !== -1 && !/generate|pdf/.test(String(url))) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: id, status: 'PROCESSING' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return realFetch.call(this, url, init);
    };
    check('nothing runs, no pill', !seen(pill()));
    V.fakeResponse(
      '/v1/documents/{id}/generate',
      'post',
      202,
      null,
      location.origin + '/v1/documents/' + id + '/generate',
      { date: new Date().toUTCString().split(',') },
      38,
    );
    V.until(
      function () {
        return seen(pill()) && /PROCESSING/.test(pill().textContent);
      },
      function () {
        const box = pill().getBoundingClientRect();
        check(
          'a run floats as a pill at the foot of the screen',
          box.bottom <= innerHeight &&
            box.bottom > innerHeight - 60 &&
            Math.abs(box.left + box.width / 2 - innerWidth / 2) < 2,
          { bottom: box.bottom, left: box.left },
        );
        check(
          'with its id, stages and state',
          pill().textContent.indexOf('31f7dfab') === 0 &&
            pill().querySelectorAll('.emit-live-pill__stages i').length === 3,
          pill().textContent,
        );
        const row = document.getElementById('operations-Documents-requestDocumentGeneration');
        check(
          'a row keeps to method, path, answer and scope glyph',
          !seen(row.querySelector('.emit-op-icon')) &&
            !seen(row.querySelector('.opblock-summary-description')) &&
            seen(row.querySelector('.emit-scope svg')) &&
            !seen(row.querySelector('.emit-scope__label')),
        );
        const head = document.querySelector('h3.opblock-tag[data-tag="Documents"]');
        const tool = head.querySelector('.emit-tag-all').getBoundingClientRect();
        check(
          'a section keeps Open all at the end of its line, by the room of its fold control',
          head.getBoundingClientRect().right - tool.right <= 24,
          { head: head.getBoundingClientRect().right, tool: tool.right },
        );
        V.open('Tenants', 'createTenant', 0);
        V.until(
          function () {
            return !!document.querySelector('#operations-Tenants-createTenant .emit-sends button');
          },
          actionBar,
          8000,
        );
      },
      8000,
    );
  },
  20000,
);

function actionBar() {
  const sends = document.querySelector('#operations-Tenants-createTenant .emit-sends');
  const link = sends.querySelector('button').getBoundingClientRect(),
    box = sends.getBoundingClientRect();
  check(
    'the action bar says what a call sends in full, wrapping instead of cutting',
    sends.scrollWidth <= sends.clientWidth + 1 && link.right <= box.right + 1,
    { scroll: sends.scrollWidth, client: sends.clientWidth },
  );
  document.getElementById('emit-topbar-auth').click();
  V.until(
    function () {
      const d = document.getElementById('emit-auth');
      return !!d && !d.hidden;
    },
    function () {
      const sheet = document.querySelector('#emit-auth .emit-auth__box').getBoundingClientRect();
      const title = document.querySelector('#emit-auth .emit-auth__head h2').getBoundingClientRect();
      const top = document.elementFromPoint(title.left + 4, title.top + title.height / 2);
      check(
        'credentials rise as a sheet from the bottom edge, over the bar and the strip',
        Math.abs(sheet.bottom - innerHeight) < 1 && sheet.width === innerWidth && !!top && !!top.closest('#emit-auth'),
        { bottom: sheet.bottom, width: sheet.width },
      );
      done();
    },
    3000,
  );
}
