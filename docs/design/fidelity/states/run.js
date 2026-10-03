// @reference docs/design/cockpit-mockup.html#run
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'emit_fidelity');
  replay();
  openGenerate(function () {});
  running('PROCESSING');
  setTimeout(measure, 1200);
});
