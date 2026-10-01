"""Serves the demo site under /emit/, as GitHub Pages will, and runs demo/accept.js in a real browser.

Usage: python demo/check.py SITE_DIR
Exits non-zero on any failed check, any console error, or a run that did not finish.
"""
import functools
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
DRIVER = HERE.parent / 'docs' / 'design' / 'verify-realtime.js'
WAIT_MS = 90000


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class QuietServer(ThreadingHTTPServer):
    """A browser closing a connection mid-answer is not a failure of the site."""
    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], ConnectionError):
            super().handle_error(request, client_address)


def main(site):
    work = Path(tempfile.mkdtemp(prefix='emit-demo-'))
    try:
        shutil.copytree(site, work / 'serve' / 'emit')
        probe = work / 'probe.js'
        probe.write_text((DRIVER.parent / 'verify-lib.js').read_text(encoding='utf-8') + '\n'
                         + (HERE / 'accept.js').read_text(encoding='utf-8'), encoding='utf-8')
        server = QuietServer(('127.0.0.1', 0),
                                     functools.partial(QuietHandler, directory=str(work / 'serve')))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = 'http://127.0.0.1:%d/emit/' % server.server_address[1]
        try:
            driver = subprocess.run(['node', str(DRIVER), url, str(WAIT_MS), str(work / 'run')],
                                    env={**os.environ, 'INJECT': str(probe)},
                                    capture_output=True, text=True)
        finally:
            server.shutdown()
        log = json.loads((work / 'run.json').read_text(encoding='utf-8')) if (work / 'run.json').exists() else None
        if not log:
            print(driver.stdout, driver.stderr)
            return 1
        failed = [c for c in log['checks'] if not c['pass']]
        for c in log['checks']:
            print('%s %s%s' % ('ok  ' if c['pass'] else 'FAIL', c['name'],
                               '' if c['pass'] else '  -> ' + json.dumps(c.get('detail'), ensure_ascii=False)))
        for error in log['errors']:
            print('error: ' + error.splitlines()[0][:200])
        if not log.get('done'):
            print('the run did not finish within %d s' % (WAIT_MS // 1000))
        return 1 if failed or log['errors'] or not log.get('done') else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main(Path(sys.argv[1])))
