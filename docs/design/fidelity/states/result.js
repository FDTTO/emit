// @reference docs/design/cockpit-surfaces.html#result
booted(function () {
  V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 0);
  V.until(function () { return V.status('/v1/auth/login', 'post') === 200; }, function () {
    // The design shows this one where the page starts, under the pane's padding.
    setTimeout(function () { bringToTop('operations-Authentication-login', 52); }, 800);
    setTimeout(function () { bringToTop('operations-Authentication-login', 52); measure(); }, 1600);
  }, 15000);
});
