/**
 * Nocturna portable Host (Electron).
 *
 * Starts Fastify+Socket.io via ELECTRON_RUN_AS_NODE.
 * - Bind always `0.0.0.0` (HOST) — never the advertise IP.
 * - ADVERTISE_HOST is QR/join only (LAN / override); never used as listen address.
 * - Health checks use 127.0.0.1 on the Host PC only (never for player QR).
 */

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');

const SETTINGS_FILE = () =>
  path.join(app.getPath('userData'), 'nocturna-host-settings.json');

const DEFAULT_PORT = Number(process.env.PORT || 3001);
const HEALTH_TIMEOUT_MS = 45_000;
const BIND_HOST = '0.0.0.0';

let serverChild = null;
let mainWindow = null;
let starting = false;
let lastStatus = null;
/** @type {string[]} */
let recentChildLog = [];

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      port: Number(parsed.port) || DEFAULT_PORT,
      advertiseHost:
        typeof parsed.advertiseHost === 'string' ? parsed.advertiseHost : '',
      lang: parsed.lang === 'en' ? 'en' : 'it',
    };
  } catch {
    return { port: DEFAULT_PORT, advertiseHost: '', lang: 'it' };
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2));
}

function embedRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'embed');
  }
  return path.join(__dirname, 'embed');
}

function pushChildLog(line) {
  const text = String(line).trim();
  if (!text) return;
  recentChildLog.push(text);
  if (recentChildLog.length > 80) recentChildLog.shift();
  process.stdout.write(`[nocturna-server] ${text}\n`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-log', text);
  }
}

function collectLanIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const netInfo of entries) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) ips.push(netInfo.address);
    }
  }
  return ips;
}

function isLoopbackHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h.startsWith('127.')
  );
}

function buildAdvertise(port, advertiseHost) {
  const lanIps = collectLanIps();
  const override = (advertiseHost || '').trim();
  if (override) {
    try {
      const u = override.includes('://')
        ? new URL(override)
        : new URL(`http://${override}`);
      if (isLoopbackHost(u.hostname)) {
        return {
          lanIps,
          advertiseBase: null,
          lanUrls: lanIps.map((ip) => `http://${ip}:${port}`),
          error: 'Override is loopback — refused.',
        };
      }
      if (!u.port) u.port = String(port);
      u.pathname = '';
      u.search = '';
      u.hash = '';
      return {
        lanIps,
        advertiseBase: u.toString().replace(/\/$/, ''),
        lanUrls: lanIps.map((ip) => `http://${ip}:${port}`),
        error: null,
      };
    } catch {
      return {
        lanIps,
        advertiseBase: null,
        lanUrls: lanIps.map((ip) => `http://${ip}:${port}`),
        error: 'Invalid advertise override.',
      };
    }
  }
  // Prefer private LAN when available (align with shared lanAdvertise intent).
  const preferred =
    lanIps.find((ip) => {
      const m = /^(\d+)\.(\d+)\./.exec(ip);
      if (!m) return false;
      const a = Number(m[1]);
      const b = Number(m[2]);
      return (
        a === 10 ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 169 && b === 254)
      );
    }) ||
    lanIps[0] ||
    null;
  return {
    lanIps,
    advertiseBase: preferred ? `http://${preferred}:${port}` : null,
    lanUrls: lanIps.map((ip) => `http://${ip}:${port}`),
    error: preferred
      ? null
      : 'No LAN IP — connect Wi-Fi or set an advertise override.',
  };
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}

async function waitForPortFree(port, timeoutMs = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortFree(port)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

function probeHealthOnce(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 1500,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Poll Host-local health. Never uses advertise IP (bind is 0.0.0.0 / health via loopback).
 */
async function waitForHealth(port, child, timeoutMs = HEALTH_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) {
      const tail = recentChildLog.slice(-12).join('\n');
      throw new Error(
        `Server process exited (code ${child.exitCode}) before becoming healthy.` +
          (tail ? `\n${tail}` : ''),
      );
    }
    if (await probeHealthOnce(port)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  const tail = recentChildLog.slice(-12).join('\n');
  const free = await isPortFree(port);
  throw new Error(
    `Health check timeout on http://127.0.0.1:${port}/api/health` +
      (free
        ? ' (nothing is listening — spawn may have failed; see log)'
        : ' (port is occupied but /api/health did not respond)') +
      (tail ? `\n${tail}` : ''),
  );
}

function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }
    if (process.platform === 'win32') {
      execFile(
        'taskkill',
        ['/pid', String(pid), '/T', '/F'],
        { windowsHide: true },
        () => resolve(),
      );
      return;
    }
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* ignore */
      }
      resolve();
    }, 400);
  });
}

async function stopServer(portHint) {
  const child = serverChild;
  serverChild = null;
  if (!child) {
    if (portHint) await waitForPortFree(portHint, 2_000);
    return;
  }
  const pid = child.pid;
  try {
    child.removeAllListeners('exit');
  } catch {
    /* ignore */
  }
  await killProcessTree(pid);
  if (portHint) await waitForPortFree(portHint, 8_000);
}

function startEmbeddedServer(port, advertiseHost) {
  const root = embedRoot();
  const entry = path.join(root, 'run.mjs');
  if (!fs.existsSync(entry)) {
    throw new Error(
      `Embedded server missing at ${entry}. Run: npm run prepare:host`,
    );
  }

  const sharedNm = path.join(root, 'node_modules', '@nocturna', 'shared');
  if (!fs.existsSync(sharedNm)) {
    throw new Error(
      `Embedded @nocturna/shared missing at ${sharedNm}. Rebuild with npm run prepare:host.`,
    );
  }
  try {
    if (fs.lstatSync(sharedNm).isSymbolicLink()) {
      pushChildLog(
        'WARN: @nocturna/shared is a symlink — Windows portable builds need a real copy (prepare:host --install-links).',
      );
    }
  } catch {
    /* ignore */
  }

  recentChildLog = [];

  // Bind vs advertise: HOST is always all-interfaces; advertise is QR-only.
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOST: BIND_HOST,
    CLIENT_DIST: path.join(root, 'client'),
    NODE_ENV: 'production',
  };
  delete env.ELECTRON_NO_ASAR;
  if (advertiseHost && advertiseHost.trim()) {
    env.ADVERTISE_HOST = advertiseHost.trim();
  } else {
    delete env.ADVERTISE_HOST;
    delete env.ADVERTISE_BASE;
  }

  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // Detached process group on POSIX so we can kill the tree.
    detached: process.platform !== 'win32',
  });

  child.stdout.on('data', (buf) => pushChildLog(buf.toString()));
  child.stderr.on('data', (buf) => pushChildLog(buf.toString()));
  child.on('error', (err) => {
    pushChildLog(`spawn error: ${err.message}`);
  });
  child.on('exit', (code, signal) => {
    if (serverChild === child) serverChild = null;
    pushChildLog(`process exit code=${code} signal=${signal || ''}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', {
        running: false,
        exitCode: code,
        error:
          code && code !== 0
            ? `Server exited (code ${code}). ${recentChildLog.slice(-6).join(' | ')}`
            : undefined,
        settings: loadSettings(),
      });
    }
  });

  return child;
}

function hostUiFallbackHtml(detail) {
  const safe = String(detail || 'Unknown error')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Nocturna Host</title>
<style>
body{margin:0;min-height:100vh;background:#0a0a0c;color:#e7e5e4;font-family:system-ui,sans-serif;
padding:1.5rem;box-sizing:border-box}
h1{font-size:1.4rem;color:#fda4af;margin:0 0 .75rem}
pre{white-space:pre-wrap;word-break:break-word;background:#121218;padding:1rem;
border-radius:.75rem;border:1px solid rgb(255 255 255/.12);font-size:.85rem;line-height:1.4}
p{color:#a8a29e;font-size:.9rem}
</style></head><body>
<h1>Host UI failed to load</h1>
<p>The Nocturna Host window could not open its console page. Reinstall the portable build or run from source.</p>
<pre>${safe}</pre>
</body></html>`;
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  const uiPath = path.join(__dirname, 'ui', 'index.html');

  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 360,
    minHeight: 560,
    title: 'Nocturna Host',
    backgroundColor: '#0a0a0c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // false: some Windows portable builds failed to expose preload APIs under
      // sandbox+asar, leaving a blank dark window. Host UI has no remote content.
      sandbox: false,
    },
  });

  const showLoadError = (detail) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    void mainWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(hostUiFallbackHtml(detail)),
    );
  };

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    // Ignore data: fallback failures.
    if (String(url || '').startsWith('data:')) return;
    showLoadError(
      `did-fail-load code=${code}\n${desc}\nurl=${url}\nuiPath=${uiPath}\npreload=${preloadPath}\n__dirname=${__dirname}`,
    );
  });

  if (!fs.existsSync(uiPath)) {
    showLoadError(`Missing Host UI file:\n${uiPath}\n__dirname=${__dirname}`);
    return;
  }

  void mainWindow.loadFile(uiPath).catch((err) => {
    showLoadError(
      `loadFile rejected:\n${err && err.message ? err.message : err}\nuiPath=${uiPath}`,
    );
  });
}

function statusPayload(partial) {
  const settings = loadSettings();
  const port = partial.port ?? settings.port ?? DEFAULT_PORT;
  const adv = buildAdvertise(port, settings.advertiseHost);
  lastStatus = {
    running: false,
    port,
    localAdminUrl: `http://127.0.0.1:${port}`,
    lanUrls: adv.lanUrls,
    advertiseBase: adv.advertiseBase,
    settings,
    ...partial,
    // Advertise/LAN discovery errors are soft; spawn errors stay in partial.error
    error: partial.error ?? (partial.running ? adv.error : partial.error),
  };
  return lastStatus;
}

/**
 * Restart embedded server and wait until /api/health succeeds.
 */
async function boot(settings) {
  if (starting) {
    throw new Error('Server start already in progress.');
  }
  starting = true;
  const port = settings.port || DEFAULT_PORT;
  try {
    await stopServer(port);
    serverChild = startEmbeddedServer(port, settings.advertiseHost);
    await waitForHealth(port, serverChild);
    const payload = statusPayload({
      running: true,
      port,
      error: undefined,
    });
    // Soft advertise warning (no LAN) must not look like a crash.
    const adv = buildAdvertise(port, settings.advertiseHost);
    if (adv.error) payload.error = adv.error;
    lastStatus = payload;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', payload);
    }
    return payload;
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    const payload = statusPayload({
      running: false,
      port,
      error: message,
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', payload);
    }
    throw err;
  } finally {
    starting = false;
  }
}

/**
 * Read-only status — does NOT restart the server (Refresh / lang must not wipe rooms).
 */
async function getStatusSnapshot() {
  const settings = loadSettings();
  const port = settings.port || DEFAULT_PORT;
  const healthy = await probeHealthOnce(port);
  const childAlive = !!(serverChild && serverChild.exitCode === null);
  if (healthy) {
    return statusPayload({
      running: true,
      port,
      error: undefined,
    });
  }
  return statusPayload({
    running: false,
    port,
    error: childAlive
      ? `Server process is up but http://127.0.0.1:${port}/api/health is not ready.`
      : lastStatus?.error || 'Server stopped',
  });
}

app.whenReady().then(async () => {
  createWindow();
  const settings = loadSettings();

  ipcMain.handle('get-status', async () => getStatusSnapshot());
  ipcMain.handle('get-settings', async () => loadSettings());
  ipcMain.handle('save-settings', async (_e, next) => {
    const prev = loadSettings();
    const merged = {
      ...prev,
      ...next,
      port: Math.min(65535, Math.max(1, Number(next.port) || DEFAULT_PORT)),
      advertiseHost: String(
        next.advertiseHost !== undefined
          ? next.advertiseHost
          : prev.advertiseHost || '',
      ).trim(),
      lang: next.lang === 'en' || next.lang === 'it' ? next.lang : prev.lang,
    };
    if (merged.advertiseHost && isLoopbackHost(merged.advertiseHost)) {
      return { ok: false, error: 'Advertise host cannot be loopback.' };
    }
    saveSettings(merged);

    const needsRestart =
      merged.port !== prev.port ||
      merged.advertiseHost !== prev.advertiseHost ||
      !lastStatus?.running;

    if (!needsRestart) {
      // Language-only (or no-op) save — do not kill the game server.
      const status = await getStatusSnapshot();
      status.settings = merged;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server-status', status);
      }
      return { ok: true, status };
    }

    try {
      const status = await boot(merged);
      return { ok: true, status };
    } catch (err) {
      return {
        ok: false,
        error: String(err && err.message ? err.message : err),
        status: lastStatus,
      };
    }
  });
  ipcMain.handle('restart-server', async () => {
    try {
      const status = await boot(loadSettings());
      return { ok: true, status };
    } catch (err) {
      return {
        ok: false,
        error: String(err && err.message ? err.message : err),
        status: lastStatus,
      };
    }
  });
  ipcMain.handle('open-url', async (_e, url) => {
    await shell.openExternal(url);
  });
  ipcMain.handle('quit-host', () => {
    app.quit();
  });

  try {
    await boot(settings);
  } catch (err) {
    console.error(err);
    // boot() already pushed server-status with the error.
  }
});

app.on('window-all-closed', () => {
  void stopServer(loadSettings().port);
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void stopServer(loadSettings().port);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
