"""Compare the console against its mockup, element by element.

    python docs/design/fidelity.py [STATE] [--only ROLE,...] [--all] [--shots] [--base URL]

Opens the mockup from disk and the console through the verify harness in the
same state and viewport, measures every role in fidelity-roles.js on both
sides with fidelity-probe.js, and prints each property that differs, mockup
value first. Boxes are relative to the window. A screenshot tells that two
pages differ; this tells which property of which element, so a change can be
aimed at the difference instead of at an impression of it.

--shots also saves both viewports (fidelity-<state>-mock_0.png, -real_0.png)
under the verify output folder.
"""
import argparse
import json
import os
import re
import subprocess
import sys

import verify

HERE = os.path.dirname(os.path.abspath(__file__))
MOCKUPS = {name: 'file:///' + os.path.join(HERE, name).replace('\\', '/')
           for name in ('cockpit-mockup.html', 'cockpit-surfaces.html')}
WIDTH, HEIGHT = 1440, 900
VIEWPORT = '({x:0,y:0,width:%d,height:%d})' % (WIDTH, HEIGHT)

# Each state: the mockup and its hash (the first mockup when only a hash is
# given), what the console does to reach it, calling done() when it is there,
# and, for a state that needs one, the spec URL the console loads instead;
# such a console never boots, so its steps run as soon as the page does.
STATES = {
    'idle': ('idle', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.authorize('apiKeyAuth', 'emit_fidelity');
        replay();
        openGenerate(done);
    """),
    'run': ('run', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.authorize('apiKeyAuth', 'emit_fidelity');
        replay();
        openGenerate(function () {});
        running('PROCESSING');
        setTimeout(done, 1200);
    """),
    'result': ('cockpit-surfaces.html#result', """
        V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 0);
        V.until(function () { return V.status('/v1/auth/login', 'post') === 200; }, function () {
          // The design shows this one where the page starts, under the pane's padding.
          setTimeout(function () { bringToTop('operations-Authentication-login', 52); }, 800);
          setTimeout(function () { bringToTop('operations-Authentication-login', 52); done(); }, 1600);
        }, 15000);
    """),
    'body': ('cockpit-surfaces.html#body', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.open('Tenants', 'createTenant');
        setTimeout(function () { bringToTop('operations-Tenants-createTenant', 52); }, 1500);
        setTimeout(function () { bringToTop('operations-Tenants-createTenant', 52); done(); }, 2500);
    """),
    'auth': ('cockpit-surfaces.html#auth', """
        V.fakeResponse('/v1/auth/login', 'post', 200, { token: V.jwt(3500) }, '/v1/auth/login', {}, 108);
        V.until(function () { return !!V.held('bearerAuth'); }, function () {
          document.getElementById('emit-topbar-auth').click();
          setTimeout(done, 600);
        }, 5000);
    """),
    'schemas': ('cockpit-surfaces.html#schemas', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.authorize('apiKeyAuth', 'emit_fidelity');
        V.until(function () { return !!document.getElementById('emit-model-CreateTenantRequest'); }, function () {
          document.querySelector('#emit-model-CreateTenantRequest .emit-model__head').click();
          var land = function () {
            var section = document.getElementById('emit-schemas'), pane = section.closest('.swagger-ui');
            pane.scrollTop += section.getBoundingClientRect().top - pane.getBoundingClientRect().top - 72;
          };
          setTimeout(land, 800);
          setTimeout(function () { land(); done(); }, 1600);
        }, 8000);
    """),
    'failure': ('cockpit-surfaces.html#failure', """
        setTimeout(done, 3000);
    """, '/v3/api-docs-does-not-exist'),
    'legend': ('cockpit-surfaces.html#legend', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.authorize('apiKeyAuth', 'emit_fidelity');
        V.open('Documents', 'requestDocumentGeneration');
        setTimeout(function () { bringToTop('operations-Documents-requestDocumentGeneration', 52); }, 1500);
        setTimeout(function () {
          bringToTop('operations-Documents-requestDocumentGeneration', 52);
          document.getElementById('emit-legend-btn').click();
          done();
        }, 2500);
    """),
    'op': ('op', """
        V.authorize('bearerAuth', V.jwt(3600));
        V.authorize('apiKeyAuth', 'emit_fidelity');
        replay();
        V.open('Documents', 'requestDocumentGeneration');
        var land = function () { bringToTop('operations-Documents-requestDocumentGeneration'); };
        // Again once the open sheet's margin transition has settled.
        setTimeout(land, 1500);
        setTimeout(function () { land(); done(); }, 2500);
    """),
}
# The answers the mockup shows as already given: the dots in the map, the
# last result on each row, the statusbar's telemetry. The latest one last.
REPLAY = """
var replay = function () {
  var id = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20';
  V.fakeResponse('/v1/auth/login', 'post', 200, { token: V.jwt(3600) }, '/v1/auth/login', {}, 142);
  V.fakeResponse('/v1/tenants', 'post', 201, { id: id, name: 'acme', apiKey: 'emit_fidelity' }, '/v1/tenants', {}, 480);
  V.fakeResponse('/v1/documents/{id}', 'get', 404, { status: 404, message: 'Document not found: ' + id }, '/v1/documents/' + id, {}, 12);
  V.fakeResponse('/v1/documents', 'post', 201, { id: id, title: 'Q3 Invoice', status: 'PENDING' }, '/v1/documents',
    { 'ratelimit-limit': '20', 'ratelimit-remaining': '17', 'x-request-id': '8c1f3e2a-6b7d-4f10-9c55-2e8a1b4d07a2' }, 36);
};
// The mockup's idle and run states show Request PDF generation open, the
// created id carried into it. Operations open closed by default, so it is
// opened, and measured once resolved and filled.
var openGenerate = function (then) {
  V.open('Documents', 'requestDocumentGeneration', 0);
  V.until(function () {
    return !!document.querySelector('#operations-Documents-requestDocumentGeneration .responses-wrapper')
      && !!document.querySelector('#operations-Documents-requestDocumentGeneration .emit-carried');
  }, then, 10000);
};
// Scrolls the content pane so an operation's top meets the pane's, as the
// mockups show an open one.
var bringToTop = function (id, below) {
  var block = document.getElementById(id), pane = block.closest('.swagger-ui');
  pane.scrollTop += block.getBoundingClientRect().top - pane.getBoundingClientRect().top - (below || 0);
};
// A run in progress: the document's reads answer with the given state, and
// the 202 that starts the follow arrives now.
var running = function (state) {
  var id = '31f7dfab-2c4e-4b1a-9d0e-7a5c3e8f1b20', realFetch = window.fetch;
  window.fetch = function (url) {
    if (String(url).indexOf('/v1/documents/' + id) !== -1 && !/generate|pdf/.test(String(url))) {
      return Promise.resolve(new Response(JSON.stringify({ id: id, status: state }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.apply(this, arguments);
  };
  V.fakeResponse('/v1/documents/{id}/generate', 'post', 202, null, location.origin + '/v1/documents/' + id + '/generate',
    { date: new Date(Date.now() - 1400).toUTCString().split(',') }, 38);
};
"""
BOOTED = "V.until(function () { return !!V.definition('bearerAuth') && !!document.querySelector('.emit-map__item'); }, function () {%s}, 20000);"

MEASURE = "window.__log = { fidelity: window.__fidelity('%s', window.__fidelityRoles) };"


EXACT = False


def source(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        text = f.read()
    return ('window.__fidelityExact = true;' + text) if EXACT and name == 'fidelity-probe.js' else text


def measure_mock(state, out, shots):
    probe = os.path.join(verify.OUT, 'fidelity-inject.js')
    os.makedirs(verify.OUT, exist_ok=True)
    with open(probe, 'w', encoding='utf-8') as f:
        f.write(source('fidelity-probe.js') + source('fidelity-roles.js')
                # The state picker is the mockup's own chrome, not the design.
                + "addEventListener('DOMContentLoaded', function () { document.querySelector('.picker').style.display = 'none'; });"
                + "addEventListener('load', function () { setTimeout(function () { %s }, 1500); });" % (MEASURE % 'mock'))
    env = dict(os.environ, VIEW_W=str(WIDTH), VIEW_H=str(HEIGHT), INJECT=probe)
    page, _, anchor = STATES[state][0].rpartition('#')
    # The webfonts come from the network, and a slow load can push the page's
    # load event past the wait; the log is then empty and the run is retried.
    for attempt in range(3):
        subprocess.run(['node', os.path.join(HERE, 'verify-realtime.js'), MOCKUPS[page or 'cockpit-mockup.html'] + '#' + anchor,
                        '6000', out] + ([VIEWPORT] if shots else []), env=env, capture_output=True, text=True)
        with open(out + '.json', encoding='utf-8') as f:
            log = json.load(f)
        if log and 'fidelity' in log:
            return log['fidelity']
    sys.exit('the mockup produced no measurement in three runs')


def measure_real(state, out, shots):
    scenario = os.path.join(verify.OUT, 'fidelity-scenario.js')
    with open(scenario, 'w', encoding='utf-8') as f:
        f.write(source('fidelity-probe.js') + source('fidelity-roles.js')
                + REPLAY + "var done = function () { setTimeout(function () { L('fidelity', window.__fidelity('real', window.__fidelityRoles)); }, 1500); };"
                + ((BOOTED % STATES[state][1]) if len(STATES[state]) < 3 else STATES[state][1]))
    verify.ensure_static()
    name = 'vx-fidelity.html'
    spec_url = STATES[state][2] if len(STATES[state]) > 2 else None
    verify.publish(verify.build(scenario, spec_url), name)
    os.environ['VIEW_H'] = str(HEIGHT)
    try:
        log = verify.run(name, 16000, None, WIDTH, [VIEWPORT] if shots else [], out)
    finally:
        verify.remove(name)
        verify.remove('verify-lib.js')
    if 'fidelity' not in log:
        sys.exit('the console produced no measurement: %s' % log.get('errors'))
    return log['fidelity']


TEXT = {'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'color', 'textAlign'}
SRGB = re.compile(r'color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: / ([\d.e-]+))?\)')


def canonical(value):
    """color-mix() computes to color(srgb ...), a literal to rgb(a)(...)."""
    if not isinstance(value, str):
        return value
    def rgba(m):
        r, g, b = (round(float(c) * 255) for c in m.groups()[:3])
        a = m.group(4)
        return 'rgba(%d, %d, %d, %s)' % (r, g, b, ('%g' % round(float(a), 3))) if a and float(a) < 1 else 'rgb(%d, %d, %d)' % (r, g, b)
    return re.sub(r'rgba\(([^)]*), ([\d.]+)\)', lambda m: 'rgba(%s, %g)' % (m.group(1), round(float(m.group(2)), 3)),
                  SRGB.sub(rgba, value))


def same(a, b):
    try:
        return abs(float(a) - float(b)) <= (0.05 if EXACT else 1)
    except (TypeError, ValueError):
        return canonical(a) == canonical(b)


def compared(key, m, r):
    """Text properties only where text is drawn; a border colour only where a border is."""
    if key == 'text':
        return False
    if key in TEXT and not (m.get('text') or r.get('text') or 'stroke' in m):
        return False
    if key == 'borderTopColor' and m.get('borderTopWidth') == '0px' and r.get('borderTopWidth') == '0px':
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('state', nargs='?', default='idle', choices=sorted(STATES))
    parser.add_argument('--only', help='roles to report, comma-separated prefixes')
    parser.add_argument('--all', action='store_true', help='print every property, not only the differences')
    parser.add_argument('--shots', action='store_true')
    parser.add_argument('--base', default='http://localhost:8080', help='the running app to measure')
    parser.add_argument('--exact', action='store_true', help='boxes to a hundredth of a pixel, for antialiasing differences')
    args = parser.parse_args()
    verify.BASE = args.base.rstrip('/') + '/swagger/'
    global EXACT
    EXACT = args.exact

    prefix = os.path.join(verify.OUT, 'fidelity-%s-' % args.state)
    mock = measure_mock(args.state, prefix + 'mock', args.shots)
    real = measure_real(args.state, prefix + 'real', args.shots)
    only = args.only.split(',') if args.only else None

    differing = 0
    for role in mock:
        if only and not any(role.startswith(o) for o in only):
            continue
        m, r = mock[role], real.get(role)
        if m is None or r is None:
            print('%s: %s' % (role, 'missing in the mockup' if m is None else 'missing in the console'))
            differing += 1
            continue
        lines = ['    %-16s %s  ->  %s' % (k, m[k], r.get(k)) for k in m
                 if args.all or (compared(k, m, r) and not same(m[k], r.get(k)))]
        if lines:
            differing += 1
            print(role)
            print('\n'.join(lines))
    print('\n%d of %d roles differ' % (differing, len(mock)))
    if args.shots:
        print('shots: %smock_0.png  %sreal_0.png' % (prefix, prefix))
    return 1 if differing else 0


if __name__ == '__main__':
    sys.exit(main())
