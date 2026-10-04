// @widths 1280
// The page arrives whole: placeholders until the description and the faces
// are in, then sections open with their operations closed. A section opens
// or closes all of its operations at once, an open header docks under the
// titlebar once stuck, the body editor colours what is typed, an array
// parameter keeps its controls inside its fields, and the rail keeps its
// content's width while it folds. A click anywhere on a row opens it, an
// operation Swagger is still resolving holds placeholders instead of a
// spinner, and the map keeps the reader's place in its own view.
const pane = function () {
  return document.querySelector('#emit-window .swagger-container > .swagger-ui');
};
const head = function (tag) {
  return document.querySelector('h3.opblock-tag[data-tag="' + tag + '"]');
};
const opened = function (tag) {
  return document.querySelectorAll('[id^="operations-' + tag + '-"].is-open').length;
};

V.until(
  function () {
    return (
      !document.getElementById('emit-window').hasAttribute('data-revealing') &&
      !document.getElementById('emit-window').hasAttribute('data-loading') &&
      !!head('Tenants') &&
      !!head('Tenants').querySelector('.emit-tag-all')
    );
  },
  function () {
    check('the placeholders are gone once the page is in', !document.querySelector('.emit-skel'));
    check(
      'sections arrive open, operations closed',
      Array.prototype.every.call(document.querySelectorAll('h3.opblock-tag'), function (h) {
        return h.getAttribute('data-is-open') === 'true';
      }) && !document.querySelector('.opblock.is-open'),
    );
    const row = document.querySelector('#operations-Tenants-listTenants .opblock-summary');
    row.scrollIntoView({ block: 'center' });
    const corner = row.getBoundingClientRect();
    document.elementFromPoint(corner.left + 6, corner.top + 4).click();
    V.until(
      function () {
        return opened('Tenants') === 1;
      },
      function () {
        check('a click anywhere on a row opens it, its padded edge included', opened('Tenants') === 1);
        row.querySelector('.opblock-summary-control').click();
        V.until(
          function () {
            return opened('Tenants') === 0;
          },
          openAll,
          3000,
        );
      },
      3000,
    );
  },
  20000,
);

function openAll() {
  head('Tenants').querySelector('.emit-tag-all').click();
  V.until(
    function () {
      return opened('Tenants') === 5;
    },
    function () {
      check(
        'Open all opens every operation of its section, and offers to close them',
        /Close all/.test(head('Tenants').querySelector('.emit-tag-all').textContent),
      );
      check('without folding the section itself', head('Tenants').getAttribute('data-is-open') === 'true');
      head('Tenants').querySelector('.emit-tag-all').click();
      V.until(
        function () {
          return opened('Tenants') === 0;
        },
        function () {
          check(
            'Close all closes them again',
            /Open all/.test(head('Tenants').querySelector('.emit-tag-all').textContent),
          );
          stuck();
        },
        5000,
      );
    },
    5000,
  );
}

function stuck() {
  V.open('Documents', 'listDocuments', 0);
  V.until(
    function () {
      return !!document.querySelector(
        '#operations-Documents-listDocuments tr[data-param-name="sort"] .json-schema-form-item-remove',
      );
    },
    function () {
      const block = document.getElementById('operations-Documents-listDocuments');
      const field = block
        .querySelector('tr[data-param-name="sort"] .json-schema-form-item input')
        .getBoundingClientRect();
      const remove = block
        .querySelector('tr[data-param-name="sort"] .json-schema-form-item-remove')
        .getBoundingClientRect();
      check(
        'an array item removes itself from inside its field',
        remove.left > field.left &&
          remove.right <= field.right &&
          remove.top >= field.top &&
          remove.bottom <= field.bottom,
        { field: field.right, remove: remove.right },
      );

      pane().scrollTop += block.getBoundingClientRect().top - pane().getBoundingClientRect().top + 160;
      V.until(
        function () {
          return block.hasAttribute('data-emit-stuck');
        },
        function () {
          const summary = block.querySelector('.opblock-summary');
          check(
            'a stuck header docks: square top, flush under the titlebar',
            getComputedStyle(summary).borderTopLeftRadius === '0px' &&
              Math.abs(summary.getBoundingClientRect().top - pane().getBoundingClientRect().top) < 1,
            {
              radius: getComputedStyle(summary).borderTopLeftRadius,
              top: summary.getBoundingClientRect().top,
              pane: pane().getBoundingClientRect().top,
            },
          );
          pane().scrollTop = 0;
          V.until(
            function () {
              return !block.hasAttribute('data-emit-stuck');
            },
            editor,
            3000,
          );
        },
        3000,
      );
    },
    10000,
  );
}

function editor() {
  V.open('Documents', 'createDocument', 0);
  V.until(
    function () {
      return !!document.querySelector('#operations-Documents-createDocument .emit-paint');
    },
    function () {
      const block = document.getElementById('operations-Documents-createDocument');
      const area = block.querySelector('textarea.body-param__text'),
        paint = block.querySelector('.emit-paint');
      const a = area.getBoundingClientRect(),
        p = paint.getBoundingClientRect();
      check(
        'the colours lie exactly under the text',
        a.top === p.top && a.left === p.left && a.width === p.width && a.height === p.height,
        { area: [a.top, a.height], paint: [p.top, p.height] },
      );
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, '{\n  "title": 42\n}');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      check(
        'and follow what is typed',
        paint.textContent === area.value + '\n' &&
          paint.querySelector('.k').textContent === '"title"' &&
          paint.querySelector('.n').textContent === '42',
      );
      rail();
    },
    10000,
  );
}

function rail() {
  const aside = document.getElementById('emit-rail');
  const width = aside.querySelector('.emit-map').getBoundingClientRect().width;
  document.querySelector('.emit-rail-toggle').click();
  check(
    'folding, the rail keeps its content at full width',
    aside.querySelector('.emit-map').getBoundingClientRect().width === width,
    width,
  );
  document.querySelector('.emit-rail-toggle').click();
  resolving();
}

function resolving() {
  const body = document.querySelector('#operations-Documents-createDocument .opblock-body');
  const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  spinner.setAttribute('class', 'opblock-loading-animation');
  body.insertBefore(spinner, body.firstChild);
  check(
    'an operation still resolving holds placeholders, not the spinner Swagger draws',
    getComputedStyle(spinner).display === 'none' && getComputedStyle(body, '::before').content !== 'none',
  );
  spinner.remove();
  following();
}

function following() {
  const win = document.getElementById('emit-window');
  const map = document.getElementById('emit-map');
  win.style.height = '460px';
  map.scrollTop = 0;
  pane().scrollTop = pane().scrollHeight;
  V.until(
    function () {
      return map.dataset.current === 'emit-schemas';
    },
    function () {
      V.until(
        function () {
          const item = map.querySelector('.emit-map__item.is-current');
          const a = item.getBoundingClientRect(),
            b = map.getBoundingClientRect();
          return a.top >= b.top && a.bottom <= b.bottom;
        },
        function () {
          const item = map.querySelector('.emit-map__item.is-current');
          const a = item.getBoundingClientRect(),
            b = map.getBoundingClientRect();
          check(
            'the map scrolls to keep the place of the reader in view',
            a.top >= b.top && a.bottom <= b.bottom && map.scrollTop > 0,
            { item: [a.top, a.bottom], map: [b.top, b.bottom], scrolled: map.scrollTop },
          );
          win.style.height = '';
          done();
        },
        3000,
      );
    },
    3000,
  );
}
