/**
 * Nocturna portable Host (Electron).
 *
 * Starts Fastify+Socket.io via ELECTRON_RUN_AS_NODE. Port and advertise host
 * are configurable (persisted). Join/QR never use loopback — only LAN URLs
 * or an explicit non-loopback override are shown to players.
 */

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const SETTINGS_FILE = () =>
  path.join(app.getPath('userData'), 'nocturna-host-settings.json');

const DEFAULT_PORT = Number(process.env.PORT || 3001);

let serverChild = null;
let mainWindow = null;
let starting = false;
let activePort = DEFAULT_PORT;

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      port: Number(parsed.port) || DEFAULT_PORT,
      advertiseHost: typeof parsed.advertiseHost === 'string' ? parsed.advertiseHost : '',
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

function collectLanIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
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
  const preferred = lanIps[0] || null;
  return {
    lanIps,
    advertiseBase: preferred ? `http://${preferred}:${port}` : null,
    lanUrls: lanIps.map((ip) => `http://${ip}:${port}`),
    error: preferred
      ? null
      : 'No LAN IP — connect Wi-Fi or set an advertise override.',
  };
}

function waitForHealth(port, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      // Health check may use loopback on the Host machine only — never for QR.
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() - started > timeoutMs) {
          reject(new Error('Health check timeout'));
        } else setTimeout(tick, 250);
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Health check timeout'));
        } else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function stopServer() {
  if (serverChild) {
    serverChild.kill();
    serverChild = null;
  }
}

function startEmbeddedServer(port, advertiseHost) {
  const root = embedRoot();
  const entry = path.join(root, 'run.mjs');
  if (!fs.existsSync(entry)) {
    throw new Error(
      `Embedded server missing at ${entry}. Run: npm run prepare:host`,
    );
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOST: '0.0.0.0',
    CLIENT_DIST: path.join(root, 'client'),
    NODE_ENV: 'production',
  };
  if (advertiseHost && advertiseHost.trim()) {
    env.ADVERTISE_HOST = advertiseHost.trim();
  }

  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (buf) => {
    const line = buf.toString();
    process.stdout.write(`[nocturna-server] ${line}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-log', line.trim());
    }
  });
  child.stderr.on('data', (buf) => {
    process.stderr.write(`[nocturna-server] ${buf}`);
  });
  child.on('exit', (code) => {
    serverChild = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', {
        running: false,
        exitCode: code,
      });
    }
  });

  return child;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 360,
    minHeight: 560,
    title: 'Nocturna Host',
    backgroundColor: '#0a0a0c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

async function boot(settings) {
  if (starting) return;
  starting = true;
  const port = settings.port || DEFAULT_PORT;
  activePort = port;
  try {
    stopServer();
    serverChild = startEmbeddedServer(port, settings.advertiseHost);
    await waitForHealth(port);
    const adv = buildAdvertise(port, settings.advertiseHost);
    const payload = {
      running: true,
      port,
      // Host-only admin open (loopback OK for the Host PC browser)
      localAdminUrl: `http://127.0.0.1:${port}`,
      lanUrls: adv.lanUrls,
      advertiseBase: adv.advertiseBase,
      error: adv.error,
      settings,
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', payload);
    }
    return payload;
  } finally {
    starting = false;
  }
}

app.whenReady().then(async () => {
  createWindow();
  const settings = loadSettings();

  ipcMain.handle('get-status', async () => boot(loadSettings()));
  ipcMain.handle('get-settings', async () => loadSettings());
  ipcMain.handle('save-settings', async (_e, next) => {
    const merged = {
      ...loadSettings(),
      ...next,
      port: Math.min(65535, Math.max(1, Number(next.port) || DEFAULT_PORT)),
      advertiseHost: String(next.advertiseHost || '').trim(),
    };
    if (isLoopbackHost(merged.advertiseHost)) {
      return { ok: false, error: 'Advertise host cannot be loopback.' };
    }
    saveSettings(merged);
    const status = await boot(merged);
    return { ok: true, status };
  });
  ipcMain.handle('open-url', async (_e, url) => {
    // Allow opening localAdminUrl on Host PC; never put loopback in QR UI.
    await shell.openExternal(url);
  });
  ipcMain.handle('quit-host', () => {
    app.quit();
  });

  try {
    await boot(settings);
  } catch (err) {
    console.error(err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', {
        running: false,
        error: String(err && err.message ? err.message : err),
        settings,
      });
    }
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

void activePort;
