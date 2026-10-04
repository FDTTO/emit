// @reference docs/design/cockpit-surfaces.html#legend
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'emit_fidelity');
  V.open('Documents', 'requestDocumentGeneration');
  setTimeout(function () {
    bringToTop('operations-Documents-requestDocumentGeneration', 52);
  }, 1500);
  setTimeout(function () {
    bringToTop('operations-Documents-requestDocumentGeneration', 52);
    document.getElementById('emit-legend-btn').click();
    measure();
  }, 2500);
});
