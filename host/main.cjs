/**
 * Nocturna portable Host (Electron).
 *
 * Starts the Fastify + Socket.io stack by launching the embedded server with
 * ELECTRON_RUN_AS_NODE (no separate Node.js install required for the Host).
 * Players join from any phone browser on the LAN — they never install Node.
 */

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const DEFAULT_PORT = Number(process.env.PORT || 3001);
let serverChild = null;
let mainWindow = null;
let starting = false;

function embedRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'embed');
  }
  return path.join(__dirname, 'embed');
}

function collectLanUrls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

function waitForHealth(port, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/health`,
        (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else if (Date.now() - started > timeoutMs) {
            reject(new Error('Health check timeout'));
          } else {
            setTimeout(tick, 250);
          }
        },
      );
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Health check timeout'));
        } else {
          setTimeout(tick, 250);
        }
      });
    };
    tick();
  });
}

function startEmbeddedServer(port) {
  const root = embedRoot();
  const entry = path.join(root, 'run.mjs');
  if (!fs.existsSync(entry)) {
    throw new Error(
      `Embedded server missing at ${entry}. Run: npm run prepare:host`,
    );
  }

  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOST: '0.0.0.0',
      CLIENT_DIST: path.join(root, 'client'),
      NODE_ENV: 'production',
    },
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
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 520,
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

async function boot() {
  if (starting) return;
  starting = true;
  const port = DEFAULT_PORT;
  try {
    if (!serverChild) {
      serverChild = startEmbeddedServer(port);
    }
    await waitForHealth(port);
    const payload = {
      running: true,
      port,
      localUrl: `http://127.0.0.1:${port}`,
      lanUrls: collectLanUrls(port),
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
  ipcMain.handle('get-status', async () => boot());
  ipcMain.handle('open-local', async (_e, url) => {
    await shell.openExternal(url);
  });
  ipcMain.handle('quit-host', () => {
    app.quit();
  });

  try {
    await boot();
  } catch (err) {
    console.error(err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-status', {
        running: false,
        error: String(err && err.message ? err.message : err),
      });
    }
  }
});

app.on('window-all-closed', () => {
  if (serverChild) {
    serverChild.kill();
    serverChild = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverChild) {
    serverChild.kill();
    serverChild = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
