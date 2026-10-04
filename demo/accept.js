// The demo held against the app it records: its answers to demo/cases.json
// must read as the app's own (ids and numbers aside), and Run all steps must
// walk the whole journey in the page. Run by `prumo visit` at document
// start, after Prumo's core, so the page loads with nothing remembered.

const normalize = function (message) {
  return String(message)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
    .replace(/\d+/g, '{n}');
};
const json = function (path) {
  return fetch(path).then(function (response) {
    return response.json();
  });
};
const call = function (method, path, body, headers) {
  return fetch(path, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(function (response) {
    return response.text().then(function (text) {
      return { status: response.status, body: text ? JSON.parse(text) : null };
    });
  });
};
const waitFor = function (check) {
  return new Promise(function (resolve) {
    V.until(check, resolve, 40000);
  });
};
const untilDone = function (id, key) {
  return call('GET', '/v1/documents/' + id, undefined, key).then(function (read) {
    return read.body.status === 'DONE'
      ? read.body
      : new Promise(function (resolve) {
          setTimeout(resolve, 100);
        }).then(function () {
          return untilDone(id, key);
        });
  });
};

function answers() {
  const stamp = Date.now().toString(36);
  const fill = {};
  const credentials = {
    none: {},
    badToken: { Authorization: 'Bearer not.a.token' },
    badKey: { 'X-API-Key': 'not-a-key' },
  };
  return Promise.all([json('../demo/cases.json'), json('../demo/answers.json'), json('../v3/api-docs.json')]).then(
    function (loaded) {
      const cases = loaded[0],
        recorded = loaded[1];
      const example = {};
      Object.keys(loaded[2].components.schemas.CreateDocumentRequest.properties).forEach(function (name) {
        example[name] = loaded[2].components.schemas.CreateDocumentRequest.properties[name].example;
      });
      return call('POST', '/v1/auth/login', { username: 'admin', password: 'admin123' })
        .then(function (login) {
          credentials.admin = { Authorization: 'Bearer ' + login.body.token };
          return Promise.all([
            call('POST', '/v1/tenants', { name: 'Accept ' + stamp, schemaName: 'accept_' + stamp }, credentials.admin),
            call(
              'POST',
              '/v1/tenants',
              { name: 'Accept off ' + stamp, schemaName: 'accept_off_' + stamp },
              credentials.admin,
            ),
          ]);
        })
        .then(function (made) {
          credentials.tenant = { 'X-API-Key': made[0].body.apiKey };
          credentials.inactive = { 'X-API-Key': made[1].body.apiKey };
          fill['{schema}'] = made[0].body.schemaName;
          return call('POST', '/v1/tenants/' + made[1].body.id + '/deactivate', undefined, credentials.admin);
        })
        .then(function () {
          return Promise.all([
            call('POST', '/v1/documents', example, credentials.tenant),
            call('POST', '/v1/documents', example, credentials.tenant),
          ]);
        })
        .then(function (documents) {
          fill['{pending}'] = documents[0].body.id;
          fill['{done}'] = documents[1].body.id;
          fill['{unknown}'] = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
          fill['{long}'] = new Array(257).join('x');
          return call('POST', '/v1/documents/' + fill['{done}'] + '/generate', undefined, credentials.tenant).then(
            function () {
              return untilDone(fill['{done}'], credentials.tenant);
            },
          );
        })
        .then(function () {
          return cases.reduce(function (previous, item, index) {
            return previous.then(function () {
              let text = JSON.stringify(item);
              Object.keys(fill).forEach(function (placeholder) {
                text = text.split(placeholder).join(fill[placeholder]);
              });
              const resolved = JSON.parse(text);
              return call(resolved.method, resolved.path, resolved.body, credentials[resolved.auth]).then(
                function (got) {
                  const app = recorded[index];
                  const demo = { status: got.status, message: got.body && got.body.message };
                  check(
                    'answers as the app does: ' + item.name,
                    app.name === item.name &&
                      demo.status === app.status &&
                      normalize(demo.message) === normalize(app.message),
                    { demo: demo, app: app },
                  );
                },
              );
            });
          }, Promise.resolve());
        });
    },
  );
}

function journey() {
  const count = function () {
    return (V.text('.emit-journey__count') || '').trim();
  };
  const run = function () {
    return document.querySelector('.emit-journey-run');
  };
  check(
    'the page says no server is answering',
    /Demo/.test(V.text('.emit-status__demo') || ''),
    V.text('.emit-status__demo'),
  );
  run().click();
  return waitFor(function () {
    return count() === '5 / 5' && run().hidden;
  }).then(function () {
    check('Run all steps walks the whole journey in the page', count() === '5 / 5', count());
    const edges = Array.prototype.map.call(
      document.querySelectorAll('#emit-lifecycle .emit-flow-link'),
      function (link) {
        return link.textContent;
      },
    );
    check(
      'the lifecycle times the run with the recorded timings',
      /^kafka\d+ ms\|render\d+ ms$/.test(edges.join('|')),
      edges,
    );
  });
}

// The theme is a tree of @imports the export copies file by file: a sheet
// it missed loads as an empty one, and the page still runs, unstyled.
function stylesheets() {
  let loaded = 0,
    missing = [];
  const walk = function (sheet) {
    Array.prototype.forEach.call(sheet.cssRules, function (rule) {
      if (!(rule instanceof CSSImportRule)) return;
      if (!rule.styleSheet || !rule.styleSheet.cssRules.length) return missing.push(rule.href);
      loaded++;
      walk(rule.styleSheet);
    });
  };
  Array.prototype.forEach.call(document.styleSheets, function (sheet) {
    // A sheet from another origin, the webfonts, keeps its rules unreadable.
    if (!sheet.href || new URL(sheet.href).origin === location.origin) walk(sheet);
  });
  check('every stylesheet the theme imports loaded', loaded > 0 && !missing.length, {
    loaded: loaded,
    missing: missing,
  });
}

V.until(
  function () {
    return (
      !!document.querySelector('.emit-journey-run') &&
      !document.getElementById('emit-window').hasAttribute('data-loading')
    );
  },
  function () {
    stylesheets();
    answers()
      .then(journey)
      .then(done, function (failure) {
        check('the run finished', false, String((failure && failure.stack) || failure));
        done();
      });
  },
  30000,
);
