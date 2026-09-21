// Real-time headless run over the DevTools protocol.
//
// Why it exists: `msedge --virtual-time-budget` fast-forwards the clock
// whenever the page is idle, so any behaviour paced by timers against a real
// backend - the lifecycle follow waits 1s, 2s, 4s, 8s between reads while the
// PDF pipeline takes ~8s of wall-clock time - runs out its schedule in well
// under a second of real time and reports a state the real page never shows.
// This runs the page on the real clock instead. It also captures regions below
// the fold without scrolling, which `--screenshot` cannot do.
//
// Usage: node verify-realtime.js <url> <waitMs> <outPrefix> [clipExprJs...]
//        VIEW_W=375 sets the viewport width; VIRTUAL_MS=60000 runs on virtual
//        time instead of waiting waitMs of wall clock; BROWSER names the
//        Chromium to drive, otherwise the first one installed is used.
// After waitMs of wall-clock time it reads window.__log from the page into
// <outPrefix>.json and, for each clip expression (JS returning
// {x,y,width,height} in page coordinates), saves a 2x screenshot of that
// region as <outPrefix>_<n>.png. Needs Node 22+ (native WebSocket and fetch).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [url, waitMs, outPrefix, ...clips] = process.argv.slice(2);

const INSTALLED = {
  win32: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
           '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
};
const BROWSER = process.env.BROWSER || (INSTALLED[process.platform] || []).find((candidate) => fs.existsSync(candidate));
if (!BROWSER || !fs.existsSync(BROWSER)) {
  console.log(BROWSER ? `error: BROWSER points to nothing: ${BROWSER}`
                      : 'error: no Chromium browser found; set BROWSER to its executable');
  process.exit(1);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));

const child = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion',
  // Port 0: the browser picks a free port and writes it to DevToolsActivePort
  // in the profile. A fixed port can attach to a previous run's instance that
  // is still shutting down.
  '--window-size=1280,1400', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  // CI runners on recent Ubuntu block the unprivileged user namespaces
  // Chrome's sandbox needs; the page under test is our own.
  ...(process.env.CI ? ['--no-sandbox'] : []),
  'about:blank'
], { stdio: 'ignore' });
// Unhandled, a failed launch kills this process before the profile is
// removed; handled, the run waits out its ceiling and cleans up as usual.
child.on('error', (error) => console.log('error: the browser did not start: ' + error.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keys a scenario can press: name -> [key, code, virtual key code, text].
const KEYS = {
  Tab: ['Tab', 'Tab', 9, ''], Enter: ['Enter', 'Enter', 13, '\r'], Escape: ['Escape', 'Escape', 27, ''],
  Space: [' ', 'Space', 32, ' '], ArrowDown: ['ArrowDown', 'ArrowDown', 40, ''], ArrowUp: ['ArrowUp', 'ArrowUp', 38, '']
};

// "Shift+Tab" style names add modifiers (Alt 1, Ctrl 2, Meta 4, Shift 8).
async function press(send, name) {
  const parts = String(name).split('+');
  const spec = KEYS[parts.pop()];
  if (!spec) return;
  const modifiers = parts.reduce((m, p) => m | ({ Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 }[p] || 0), 0);
  const [key, code, keyCode, text] = spec;
  const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', text, ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// A ceiling, not a delay: under load (parallel runs, a JVM starting) Edge can
// take well over ten seconds to write DevToolsActivePort.
async function target() {
  for (let i = 0; i < 150; i++) {
    try {
      const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0].trim();
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return { ws: page.webSocketDebuggerUrl, port };
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('DevTools endpoint never came up');
}

/*
 * On Windows the launched executable hands off to the real browser process
 * and exits, so killing its process tree kills nothing and leaks a browser
 * and a profile per run. The browser is closed over the protocol, the
 * profile removed with retries while Windows releases its files, and only
 * as a last resort are the processes holding this run's profile killed.
 */
async function shutdown(port) {
  try {
    if (port) {
      const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const browser = new WebSocket(version.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browser.addEventListener('open', resolve, { once: true });
        browser.addEventListener('error', reject, { once: true });
      });
      browser.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      await sleep(300);
    }
  } catch (e) { /* the forceful path below still runs */ }
  // A browser that never became controllable may still be starting, and would
  // recreate the profile after it was removed, so it is killed first.
  if (!port) killProfileProcesses();
  for (let i = 0; i < 20; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch (e) { await sleep(250); }
  }
  if (fs.existsSync(profile)) {
    killProfileProcesses();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* reported below */ }
  }
  if (!port) await sleep(1000);
  if (fs.existsSync(profile)) {
    killProfileProcesses();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { console.log('warning: profile left behind at ' + profile); }
  }
}

// Only the processes started with this run's profile, whatever the browser.
function killProfileProcesses() {
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='${path.basename(BROWSER)}'" | Where-Object { $_.CommandLine -like '*${profile}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`]);
  } else {
    child.kill('SIGKILL');
    spawnSync('pkill', ['-KILL', '-f', profile]);
  }
}

(async () => {
  let ws;
  let port;
  try {
    const endpoint = await target();
    port = endpoint.port;
    ws = new WebSocket(endpoint.ws);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    const events = new Map();
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      if (msg.method && events.has(msg.method)) { events.get(msg.method)(msg); events.delete(msg.method); }
    });
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;

    await send('Page.enable');
    // --window-size is not honoured for a page opened over the protocol, so
    // the viewport is set here. VIEW_W overrides the width (default 1280).
    await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.VIEW_W || 1280), height: 1400, deviceScaleFactor: 1, mobile: false });
    // A headless page does not always hold the window's focus, and keys sent
    // to an unfocused page go nowhere. This makes the page behave as focused.
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    // VIRTUAL_MS switches to virtual time: the clock is paused until the page
    // has started loading, then runs on a budget that stops for network
    // fetches. Fast for long idle scenarios, but idle time is skipped and
    // animation frames are starved, so it cannot judge anything paced by time.
    const virtual = Number(process.env.VIRTUAL_MS || 0);
    if (virtual) {
      await send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
      await send('Page.navigate', { url });
      const expired = new Promise((r) => events.set('Emulation.virtualTimeBudgetExpired', r));
      await send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: virtual });
      // The budget-expired event does not always arrive; the log is read either
      // way, so a missed event costs a little wall clock, never the result.
      await Promise.race([expired, sleep(virtual + 20000)]);
    } else {
      await send('Page.navigate', { url });
      // While waiting, deliver the keys the page asked for (V.press) as real,
      // trusted input. Synthetic events from inside the page are untrusted,
      // and Chromium only shows :focus-visible after real keyboard input, so
      // anything about keyboard focus can only be judged this way.
      const end = Date.now() + Number(waitMs);
      while (Date.now() < end) {
        const keys = await evaluate('(window.__verifyKeys || []).splice(0)');
        for (const key of keys || []) await press(send, key);
        if (await evaluate('!!(window.__log && window.__log.done)')) break;
        await sleep(40);
      }
    }

    const log = await evaluate('JSON.stringify(window.__log || null)');
    fs.writeFileSync(`${outPrefix}.json`, log || 'null');
    for (let i = 0; i < clips.length; i++) {
      const box = await evaluate(clips[i]);
      if (!box) continue;
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 2 } });
      fs.writeFileSync(`${outPrefix}_${i}.png`, Buffer.from(shot.result.data, 'base64'));
    }
    console.log('done');
  } catch (e) {
    console.log('error: ' + e.message);
  } finally {
    if (ws) ws.close();
    await shutdown(port);
  }
})();
