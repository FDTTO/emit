// @reference docs/design/cockpit-surfaces.html#failure
// A description that does not load: the page never boots, so the state
// is measured once the failure is drawn.
window.scenarioConfig = { url: '/v3/api-docs-does-not-exist' };
setTimeout(measure, 3000);
