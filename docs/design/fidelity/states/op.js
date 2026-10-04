// @reference docs/design/cockpit-mockup.html#op
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'emit_fidelity');
  replay();
  V.open('Documents', 'requestDocumentGeneration');
  const land = function () { bringToTop('operations-Documents-requestDocumentGeneration'); };
  // Again once the open sheet's margin transition has settled.
  setTimeout(land, 1500);
  setTimeout(function () { land(); measure(); }, 2500);
});
