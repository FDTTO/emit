"""Run verification scenarios against the running app's Swagger UI.

    python docs/design/verify.py SCENARIO.js [options]   one scenario, JSON log
    python docs/design/verify.py --suite [DIR]           every scenario, a table

A scenario is plain JavaScript run inside verify-harness.html after
verify-lib.js. It acts on the page through V.*, records values with
L(key, value) and expectations with check(name, pass, detail). This script
builds the page, publishes it next to the app's static Swagger files, runs it
in headless Edge, reads the log back and removes what it published.

Modes:
  realtime (default)  wall clock. Honest for timers, rAF and any backend that
                      takes real time.
  --virtual MS        virtual time on a budget: fast for long idle scenarios,
                      but idle time is skipped and animation frames are
                      starved, so it cannot judge anything paced by time.
Both run over the DevTools protocol (verify-realtime.js): the viewport is set
exactly, 320px included, and --clip captures regions below the fold.

Suite mode runs every *.js in docs/design/scenarios (or DIR), once per width
the scenario declares in its header, several at a time. A header is a run of
comment lines at the top of the file:
    // @widths 320,1280       default 1280
    // @wait 30000            realtime ceiling, default 30000; a run ends
                              as soon as the scenario calls done()
    // @virtual 40000         run on virtual time instead
    // @spec-url /missing     point the page at another spec
It prints one line per run and exits 1 if any check failed, any console error
was logged, or a run produced no log at all.

Options (single run):
  --width W  --wait MS  --virtual MS  --spec-url URL  --clip JS (repeatable)
  --out PREFIX  --keep
Options (suite):
  --only TEXT   run only scenarios whose file name contains TEXT
  --jobs N      runs at a time (default 3)
  --verbose     print every check, not only the failures
"""
import argparse
import concurrent.futures
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
STATIC = os.path.join(ROOT, 'target', 'classes', 'static', 'swagger')
BASE = 'http://localhost:8080/swagger/'
SCENARIOS = os.path.join(HERE, 'scenarios')
OUT = os.path.join(tempfile.gettempdir(), 'verify')


def build(scenario, spec_url):
    with open(os.path.join(HERE, 'verify-harness.html'), encoding='utf-8') as f:
        page = f.read()
    if spec_url:
        page = page.replace("url: '/v3/api-docs'", "url: '%s'" % spec_url)
    with open(scenario, encoding='utf-8-sig') as f:
        body = f.read()
    # Each scenario runs in its own function scope. At the top level of a
    # classic script, `var name = function ...` assigns window.name, which
    # stringifies whatever it is given.
    injected = ('<script src="/swagger/verify-lib.js"></script>\n<script>\n(function () {\n%s\n})();\n</script>\n</body>'
                % body)
    return page.replace('</body>', injected, 1)


def ensure_static():
    if not os.path.isdir(STATIC):
        sys.exit('No %s: build the app first (mvn -q resources:resources).' % STATIC)
    shutil.copy(os.path.join(HERE, 'verify-lib.js'), STATIC)


def publish(page, name):
    with open(os.path.join(STATIC, name), 'w', encoding='utf-8') as f:
        f.write(page)


def remove(name):
    path = os.path.join(STATIC, name)
    if os.path.exists(path):
        os.remove(path)


def run(name, wait, virtual, width, clips, out):
    """Runs one published page and returns its log, or an explanation."""
    env = dict(os.environ, VIEW_W=str(width), VIRTUAL_MS=str(virtual or 0))
    done = subprocess.run(['node', os.path.join(HERE, 'verify-realtime.js'), BASE + name, str(wait), out] + clips,
                          env=env, capture_output=True, text=True)
    if done.returncode != 0 or 'error' in done.stdout:
        return {'errors': ['runner failed: ' + (done.stdout + done.stderr).strip()[:400]], 'checks': []}
    with open(out + '.json', encoding='utf-8') as f:
        return json.load(f) or {'errors': ['the page produced no log'], 'checks': []}


def header(path):
    settings = {'widths': [1280], 'wait': 30000, 'virtual': None, 'spec_url': None}
    with open(path, encoding='utf-8-sig') as f:
        for line in f:
            match = re.match(r'\s*//\s*@(\S+)\s+(.+)', line)
            if not match:
                if line.strip() and not line.strip().startswith('//'):
                    break
                continue
            key, value = match.group(1), match.group(2).strip()
            if key == 'widths':
                settings['widths'] = [int(w) for w in value.split(',')]
            elif key == 'wait':
                settings['wait'] = int(value)
            elif key == 'virtual':
                settings['virtual'] = int(value)
            elif key == 'spec-url':
                settings['spec_url'] = value
    return settings


def suite(directory, only, jobs, verbose):
    scenarios = sorted(glob.glob(os.path.join(directory, '*.js')))
    if only:
        scenarios = [s for s in scenarios if only in os.path.basename(s)]
    if not scenarios:
        sys.exit('No scenarios in %s' % directory)

    runs = []
    for path in scenarios:
        settings = header(path)
        page = build(path, settings['spec_url'])
        for width in settings['widths']:
            stem = os.path.splitext(os.path.basename(path))[0]
            runs.append((stem, width, settings, page))

    ensure_static()
    names = []
    for stem, width, settings, page in runs:
        name = 'vx-%s-%d.html' % (stem, width)
        publish(page, name)
        names.append(name)

    def execute(job):
        (stem, width, settings, _), name = job
        out = os.path.join(OUT, '%s-%d' % (stem, width))
        return stem, width, run(name, settings['wait'], settings['virtual'], width, [], out)

    failed = False
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
            results = list(pool.map(execute, zip(runs, names)))
    finally:
        for name in names:
            remove(name)
        remove('verify-lib.js')

    for stem, width, log in results:
        checks = log.get('checks') or []
        passed = [c for c in checks if c['pass']]
        errors = log.get('errors') or []
        if not log.get('done'):
            errors = errors + ['scenario did not finish within its wait (no done())']
        ok = checks and len(passed) == len(checks) and not errors
        failed = failed or not ok
        print('%s %-22s %5dpx  %d/%d checks%s' % ('PASS' if ok else 'FAIL', stem, width, len(passed), len(checks),
                                                 '  %d console errors' % len(errors) if errors else ''))
        for c in checks:
            if verbose or not c['pass']:
                print('       %s %s%s' % ('ok  ' if c['pass'] else 'FAIL', c['name'],
                                        '' if c['pass'] or c['detail'] is None else '  -> ' + json.dumps(c['detail'], ensure_ascii=False)))
        for e in errors:
            print('       error: ' + e.splitlines()[0][:200])
        if not checks and not errors:
            print('       (no checks recorded)')
    return 1 if failed else 0


def single(args):
    ensure_static()
    name = 'vx-run.html'
    publish(build(args.scenario, args.spec_url), name)
    try:
        result = run(name, args.wait, args.virtual, args.width, args.clip, args.out)
    finally:
        if not args.keep:
            remove(name)
            remove('verify-lib.js')
    print(json.dumps(result, indent=1, ensure_ascii=False))
    if args.clip:
        print('screenshots: %s_<n>.png' % args.out)
    failed_checks = [c for c in (result.get('checks') or []) if not c['pass']]
    return 1 if (result.get('errors') or failed_checks) else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('scenario', nargs='?')
    parser.add_argument('--suite', nargs='?', const=SCENARIOS, metavar='DIR')
    parser.add_argument('--only')
    parser.add_argument('--jobs', type=int, default=3)
    parser.add_argument('--verbose', action='store_true')
    parser.add_argument('--virtual', type=int, metavar='MS')
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--wait', type=int, default=30000)
    parser.add_argument('--spec-url')
    parser.add_argument('--clip', action='append', default=[])
    parser.add_argument('--out', default=os.path.join(OUT, 'shot'))
    parser.add_argument('--keep', action='store_true')
    parser.add_argument('--base', default='http://localhost:8080',
                        help='app to run against, e.g. a second instance on 8081')
    args = parser.parse_args()
    global BASE
    BASE = args.base.rstrip('/') + '/swagger/'
    # The Windows console defaults to cp1252, which cannot print what the page
    # writes (arrows, for one).
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(OUT, exist_ok=True)
    if args.suite:
        return suite(args.suite, args.only, args.jobs, args.verbose)
    if not args.scenario:
        parser.error('a scenario file, or --suite')
    return single(args)


if __name__ == '__main__':
    sys.exit(main())
