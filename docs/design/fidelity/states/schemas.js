// @reference docs/design/cockpit-surfaces.html#schemas
booted(function () {
  V.authorize('bearerAuth', V.jwt(3600));
  V.authorize('apiKeyAuth', 'emit_fidelity');
  V.until(
    function () {
      return !!document.getElementById('emit-model-CreateTenantRequest');
    },
    function () {
      document.querySelector('#emit-model-CreateTenantRequest .emit-model__head').click();
      const land = function () {
        const section = document.getElementById('emit-schemas'),
          pane = section.closest('.swagger-ui');
        pane.scrollTop += section.getBoundingClientRect().top - pane.getBoundingClientRect().top - 72;
      };
      setTimeout(land, 800);
      setTimeout(function () {
        land();
        measure();
      }, 1600);
    },
    8000,
  );
});
