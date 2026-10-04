// @widths 1280
// Swagger UI's topbar marks <html> with .dark-mode when the reader's system
// is dark, and draws a toggle for it. The console is dark either way: the
// toggle is not drawn, and the stock dark rules reach nothing a reader sees.
const PROPS = ['color', 'backgroundColor', 'borderTopColor', 'fill', 'stroke', 'filter', 'boxShadow', 'opacity'];
const root = document.documentElement;

const faint = function () {
  const probe = document.createElement('i');
  probe.style.color = 'var(--e-faint)';
  document.getElementById('emit-swagger').appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
};

const shown = function () {
  return Array.prototype.filter.call(document.querySelectorAll('#emit-window *'), function (e) {
    return e.getClientRects().length && getComputedStyle(e).visibility === 'visible';
  });
};

/* Colour and border count where they paint: on an element with text of its
   own. A wrapper's inherited colour that no text reads is not seen. */
const styles = function (elements) {
  return elements.map(function (e) {
    const cs = getComputedStyle(e);
    const text = Array.prototype.some.call(e.childNodes, function (n) {
      return n.nodeType === 3 && n.textContent.trim();
    });
    return PROPS.filter(function (p) {
      return text || (p !== 'color' && p !== 'borderTopColor');
    })
      .map(function (p) {
        return cs[p];
      })
      .join('|');
  });
};

V.until(
  function () {
    return (
      !!document.querySelector('.opblock .arrow path') &&
      !!document.querySelector('.dark-mode-toggle') &&
      !document.getElementById('emit-window').hasAttribute('data-loading')
    );
  },
  function () {
    const toggle = document.querySelector('.dark-mode-toggle');
    check(
      "Swagger's dark mode toggle is not drawn, nor reachable by Tab",
      getComputedStyle(toggle).display === 'none' && toggle.querySelector('button').offsetParent === null,
    );

    const tint = faint();
    const chevrons = Array.prototype.slice.call(
      document.querySelectorAll('.opblock-tag .expand-operation svg path, .opblock .arrow path'),
    );
    const off = chevrons.filter(function (path) {
      return getComputedStyle(path).fill !== tint;
    });
    check(
      'every chevron takes the faint tint, whatever its fill attribute says',
      chevrons.length > 0 && off.length === 0,
      off.length + ' of ' + chevrons.length,
    );

    unchangedByDarkRules('with every section closed');

    V.open('Documents', 'createDocument');
    V.until(
      function () {
        return !!document.querySelector('#operations-Documents-createDocument.is-open .responses-table');
      },
      function () {
        unchangedByDarkRules('with an operation open, its body and responses drawn');

        document.querySelector('#emit-model-CreateTenantRequest .emit-model__head').click();
        V.until(
          function () {
            return !!document.querySelector('#emit-model-CreateTenantRequest .emit-field');
          },
          function () {
            unchangedByDarkRules('with a model open');
            done();
          },
        );
      },
    );
  },
  20000,
);

function unchangedByDarkRules(state) {
  const wasDark = root.classList.contains('dark-mode');
  const elements = shown();
  root.classList.remove('dark-mode');
  const light = styles(elements);
  root.classList.add('dark-mode');
  const dark = styles(elements);
  root.classList.toggle('dark-mode', wasDark);
  const changed = elements.filter(function (_, i) {
    return light[i] !== dark[i];
  });
  check(
    "a dark system changes nothing the reader sees through Swagger's own dark rules, " + state,
    elements.length > 0 && changed.length === 0,
    changed.slice(0, 3).map(function (e) {
      return e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).trim();
    }),
  );
}
