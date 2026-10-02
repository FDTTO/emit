"""Records the running application as the static demo site.

The console page and its assets, the spec, a PDF the app rendered, the
timings and rate limit of real runs, and the app's own answers to
demo/cases.json are all taken from the live app; demo/api.js replays them in
the page. Nothing in the site is written by hand.

Usage: python demo/export.py BASE_URL OUT_DIR
"""
import json
import posixpath
import re
import shutil
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
UNKNOWN_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
SWAGGER_ASSETS = ['swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-initializer.js',
                  'swagger-ui.css', 'index.css', 'favicon-32x32.png', 'favicon-16x16.png']
MEASURED_RUNS = 3

base, out = sys.argv[1].rstrip('/'), Path(sys.argv[2])


def call(method, path, body=None, headers=None):
    """Status, headers and raw body; a 429 waits out Retry-After and asks again."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base + path, data=data, method=method,
                                     headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as refused:
        if refused.code == 429:
            time.sleep(int(refused.headers.get('Retry-After') or 1))
            return call(method, path, body, headers)
        return refused.code, refused.headers, refused.read()


def ok(expected, method, path, body=None, headers=None):
    status, response_headers, raw = call(method, path, body, headers)
    if status != expected:
        sys.exit('%s %s answered %s, expected %s: %s' % (method, path, status, expected, raw[:300]))
    return response_headers, (json.loads(raw) if raw else None)


def fetched(path):
    status, _, raw = call('GET', path)
    if status != 200:
        sys.exit('GET %s answered %s' % (path, status))
    return raw


def replace_once(text, old, new, where):
    """A rewrite that does not find its target fails loudly instead of shipping a broken page."""
    if text.count(old) != 1:
        sys.exit('%s: expected "%s" once, found it %d times' % (where, old, text.count(old)))
    return text.replace(old, new)


def write(relative, content):
    path = out / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if isinstance(content, bytes) else content.encode('utf-8'))


def at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def run_document(key, body):
    """Creates, generates and follows one document to DONE."""
    created = ok(201, 'POST', '/v1/documents', body, key)[1]
    ok(202, 'POST', '/v1/documents/%s/generate' % created['id'], None, key)
    for _ in range(120):
        document = ok(200, 'GET', '/v1/documents/' + created['id'], None, key)[1]
        if document['status'] == 'DONE':
            return document
        if document['status'] == 'FAILED':
            sys.exit('document %s FAILED during the export' % created['id'])
        time.sleep(0.5)
    sys.exit('document %s did not reach DONE within a minute' % created['id'])


MODULE_IMPORT = re.compile(r"""^import [^'"]*from '(\.[^']+)';$""", re.M)
STYLE_IMPORT = re.compile(r"""^@import url\('([^'/][^']*)'\)""", re.M)
ROOTED_URL = re.compile(r"""url\('/""")


def export_graph(entry, imports):
    """A file and everything it imports by relative path, as served.

    The site is published under a project path, so a stylesheet's url('/...')
    is made relative to where the stylesheet sits."""
    seen, queue = set(), [entry]
    while queue:
        path = queue.pop()
        if path in seen:
            continue
        seen.add(path)
        source = fetched('/' + path).decode('utf-8')
        if path.endswith('.css'):
            source = ROOTED_URL.sub("url('" + '../' * path.count('/'), source)
        write(path, source)
        folder = posixpath.dirname(path)
        queue.extend(posixpath.normpath(posixpath.join(folder, spec)) for spec in imports.findall(source))
    if len(seen) < 2:
        sys.exit('%s imports nothing: the console did not come with it' % entry)


def export_page():
    page = fetched('/swagger-ui/index.html').decode('utf-8')
    for needed in ('href="/swagger/theme.css"', 'src="/swagger/emit.js"'):
        if needed not in page:
            sys.exit('index.html: expected %s' % needed)
    page = page.replace('="/swagger/', '="../swagger/')
    page = replace_once(page, '<script src="./swagger-ui-bundle.js"',
                        '<script src="../demo/api.js" charset="UTF-8"></script>\n    <script src="./swagger-ui-bundle.js"',
                        'index.html')
    write('swagger-ui/index.html', page)
    for asset in SWAGGER_ASSETS:
        write('swagger-ui/' + asset, fetched('/swagger-ui/' + asset))
    export_graph('swagger/theme.css', STYLE_IMPORT)
    export_graph('swagger/emit.js', MODULE_IMPORT)
    write('v3/api-docs.json', fetched('/v3/api-docs'))
    write('v3/swagger-config.json', fetched('/v3/api-docs/swagger-config'))
    write('index.html', '<!DOCTYPE html><meta charset="utf-8"><title>EMIT API</title>'
                        '<link rel="icon" type="image/png" href="swagger-ui/favicon-32x32.png">'
                        '<meta http-equiv="refresh" content="0; url=swagger-ui/index.html">'
                        '<a href="swagger-ui/index.html">EMIT console</a>\n')
    write('.nojekyll', '')


def export_runs():
    spec = json.loads((out / 'v3/api-docs.json').read_text(encoding='utf-8'))
    example = {name: field['example'] for name, field in
               spec['components']['schemas']['CreateDocumentRequest']['properties'].items()}
    token = ok(200, 'POST', '/v1/auth/login', {'username': 'admin', 'password': 'admin123'})[1]['token']
    admin = {'Authorization': 'Bearer ' + token}
    stamp = format(int(time.time()), 'x')
    tenant = ok(201, 'POST', '/v1/tenants', {'name': 'Demo export ' + stamp, 'schemaName': 'demo_' + stamp}, admin)[1]
    key = {'X-API-Key': tenant['apiKey']}
    inactive = ok(201, 'POST', '/v1/tenants', {'name': 'Demo inactive ' + stamp, 'schemaName': 'demo_off_' + stamp}, admin)[1]
    ok(204, 'POST', '/v1/tenants/%s/deactivate' % inactive['id'], None, admin)

    # The first run pays the consumer's warm-up; the ones measured after it are what a reader sees.
    done = run_document(key, example)
    measured = [run_document(key, example) for _ in range(MEASURED_RUNS)]
    queued = statistics.median((at(d['startedAt']) - at(d['queuedAt'])).total_seconds() * 1000 for d in measured)
    rendering = statistics.median((at(d['finishedAt']) - at(d['startedAt'])).total_seconds() * 1000 for d in measured)
    headers, _ = ok(200, 'GET', '/v1/documents', None, key)
    status, _, pdf = call('GET', '/v1/documents/%s/pdf' % measured[-1]['id'], None, key)
    if status != 200 or not pdf.startswith(b'%PDF'):
        sys.exit('the PDF download answered %s' % status)
    write('demo/sample.pdf', pdf)
    write('demo/facts.json', json.dumps({'rateLimit': int(headers['RateLimit-Limit']),
                                         'queuedMs': round(queued), 'renderingMs': round(rendering)}, indent=2))

    pending = ok(201, 'POST', '/v1/documents', example, key)[1]
    credentials = {'none': {}, 'admin': admin, 'tenant': key,
                   'badToken': {'Authorization': 'Bearer not.a.token'},
                   'badKey': {'X-API-Key': 'not-a-key'},
                   'inactive': {'X-API-Key': inactive['apiKey']}}
    fill = {'{schema}': tenant['schemaName'], '{unknown}': UNKNOWN_ID, '{pending}': pending['id'],
            '{done}': done['id'], '{long}': 'x' * 256}
    answers = []
    for case in json.loads((HERE / 'cases.json').read_text(encoding='utf-8')):
        path, body = case['path'], json.dumps(case.get('body')) if 'body' in case else None
        for placeholder, value in fill.items():
            path = path.replace(placeholder, value)
            body = body.replace(placeholder, value) if body else body
        status, _, raw = call(case['method'], path, json.loads(body) if body else None, credentials[case['auth']])
        answers.append({'name': case['name'], 'status': status, 'message': json.loads(raw).get('message') if raw else None})
    write('demo/answers.json', json.dumps(answers, indent=2))
    print('measured: %d ms queued, %d ms rendering; %d cases recorded' % (queued, rendering, len(answers)))


if out.exists():
    shutil.rmtree(out)
export_page()
export_runs()
for name in ['api.js', 'cases.json']:
    shutil.copy(HERE / name, out / 'demo' / name)
print('site written to', out)
