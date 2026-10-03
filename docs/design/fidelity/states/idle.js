// @reference docs/design/cockpit-mockup.html#idle
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'emit_fidelity');
  replay();
  openGenerate(measure);
});
