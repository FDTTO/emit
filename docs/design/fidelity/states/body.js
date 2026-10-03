// @reference docs/design/cockpit-surfaces.html#body
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.open('Tenants', 'createTenant');
  setTimeout(function () { bringToTop('operations-Tenants-createTenant', 52); }, 1500);
  setTimeout(function () { bringToTop('operations-Tenants-createTenant', 52); measure(); }, 2500);
});
