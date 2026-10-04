// @reference docs/design/cockpit-surfaces.html#auth
booted(function () {
  V.fakeResponse('/v1/auth/login', 'post', 200, { token: V.jwt(3500) }, '/v1/auth/login', {}, 108);
  V.until(
    function () {
      return !!V.held('bearerAuth');
    },
    function () {
      document.getElementById('emit-topbar-auth').click();
      setTimeout(measure, 600);
    },
    5000,
  );
});
