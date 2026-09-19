// @widths 1280,320
// @spec-url /v3/api-docs-does-not-exist
// The spec-failure state: a status heading that is not
// treated as the product title, and an error box on the page gutter at every
// width. The failed fetch is the point, so its console noise is expected.
allowErrors(/api-docs-does-not-exist|Failed to load|401/);

setTimeout(function () {
  var root = document.documentElement, width = root.clientWidth;
  var box = V.box('.errors-wrapper');
  var gutter = parseInt(getComputedStyle(root).getPropertyValue('--page-gutter'), 10);
  check('the failure is shown', !!box);
  check('no sideways scroll', root.scrollWidth <= width, { scrollWidth: root.scrollWidth, width: width });
  check('error box never closer to the edge than the gutter', !!box && box.left >= gutter && box.right <= width - gutter,
        { box: box, gutter: gutter, width: width });
  check('heading is not split as a product title', !document.querySelector('.loading-container .info .title .emit-title-name'));
  done();
}, 6000);
