// @widths 1280
// The titlebar names where the reader is. Scrolled past a section's heading
// and short of its first operation, that is the section, not the last
// operation of the section above.
const pane = function () {
  return document.querySelector('#emit-window .swagger-container > .swagger-ui');
};
const crumb = function () {
  return document.getElementById('emit-crumb').textContent;
};

/* Measured once the window has arrived: the overview's figure and faces land
   late and move everything under them. */
V.until(
  function () {
    return (
      !!document.querySelector('h3.opblock-tag[data-tag="Documents"]') &&
      !!document.querySelector('.opblock') &&
      !document.getElementById('emit-window').hasAttribute('data-loading')
    );
  },
  function () {
    const heading = document.querySelector('h3.opblock-tag[data-tag="Documents"]');
    /* The place is read on a line 64px under the pane's top: the heading just
     past it, its first operation still below. */
    const top = pane().getBoundingClientRect().top;
    pane().scrollTop += heading.getBoundingClientRect().top - top - 60;
    V.until(
      function () {
        return crumb() === 'Documents';
      },
      function () {
        check('past a section heading, the titlebar names the section', crumb() === 'Documents', crumb());
        const first = heading.closest('.opblock-tag-section').querySelector('.opblock');
        pane().scrollTop += first.getBoundingClientRect().top - pane().getBoundingClientRect().top - 20;
        V.until(
          function () {
            return /\/v1\/documents/.test(crumb());
          },
          function () {
            check(
              'past its first operation, it names the operation',
              /^Documents\/GET \/v1\/documents$/.test(crumb()),
              crumb(),
            );
            done();
          },
          3000,
        );
      },
      3000,
    );
  },
  20000,
);
