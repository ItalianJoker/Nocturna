/**
 * Prepares host/embed with production server + SPA + pruned deps
 * for Electron portable packaging (Win / Linux AppImage / macOS).
 *
 * Critical: `@nocturna/shared` must be a **real directory copy**, not a
 * symlink. Cross-building on Linux for Windows portable leaves Unix
 * symlinks that Windows cannot resolve → child exits on MODULE_NOT_FOUND
 * → Host UI shows only "Health check timeout".
 *
 * Run after `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const embed = path.join(root, 'host', 'embed');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cpDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function assertExists(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${label}: ${p}. Run npm run build first.`);
  }
}

/**
 * Replace any symlink under `dir` with a real recursive copy of its target.
 * Safe for packaging to Windows from a Linux/macOS builder.
 */
function materializeSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        const target = fs.realpathSync(full);
        const targetStat = fs.statSync(target);
        fs.rmSync(full, { recursive: true, force: true });
        if (targetStat.isDirectory()) {
          fs.cpSync(target, full, { recursive: true, dereference: true });
        } else {
          fs.copyFileSync(target, full);
        }
        continue;
      }
      if (stat.isDirectory()) walk(full);
    }
  };
  walk(dir);
}

assertExists(path.join(root, 'client/dist/index.html'), 'client build');
assertExists(path.join(root, 'server/dist/index.js'), 'server build');
assertExists(path.join(root, 'packages/shared/dist/index.js'), 'shared build');

rmrf(embed);
fs.mkdirSync(embed, { recursive: true });

cpDir(path.join(root, 'client/dist'), path.join(embed, 'client'));
cpDir(path.join(root, 'server/dist'), path.join(embed, 'server'));

fs.mkdirSync(path.join(embed, 'packages/shared'), { recursive: true });
cpDir(
  path.join(root, 'packages/shared/dist'),
  path.join(embed, 'packages/shared/dist'),
);
fs.copyFileSync(
  path.join(root, 'packages/shared/package.json'),
  path.join(embed, 'packages/shared/package.json'),
);

const serverPkg = JSON.parse(
  fs.readFileSync(path.join(root, 'server/package.json'), 'utf8'),
);

const embedPkg = {
  name: 'nocturna-embed',
  version: serverPkg.version || '1.0.0',
  private: true,
  type: 'module',
  dependencies: {
    ...Object.fromEntries(
      Object.entries(serverPkg.dependencies || {}).filter(
        ([name]) => name !== '@nocturna/shared',
      ),
    ),
    '@nocturna/shared': 'file:./packages/shared',
  },
};

fs.writeFileSync(
  path.join(embed, 'package.json'),
  JSON.stringify(embedPkg, null, 2),
);

console.log('Installing production deps into host/embed …');
// --install-links: pack file: deps as copies (not symlinks) when npm supports it.
execSync('npm install --omit=dev --no-package-lock --install-links', {
  cwd: embed,
  stdio: 'inherit',
});

// Belt-and-suspenders for older npm / residual links.
materializeSymlinks(path.join(embed, 'node_modules'));

const sharedNm = path.join(embed, 'node_modules', '@nocturna', 'shared');
if (!fs.existsSync(sharedNm)) {
  throw new Error(`embed missing ${sharedNm} after install`);
}
if (fs.lstatSync(sharedNm).isSymbolicLink()) {
  throw new Error(
    `@nocturna/shared is still a symlink at ${sharedNm} — Windows portable would fail`,
  );
}
assertExists(
  path.join(sharedNm, 'dist', 'index.js'),
  'embed @nocturna/shared dist',
);

fs.writeFileSync(
  path.join(embed, 'run.mjs'),
  `/**
 * Portable entry — used by Electron via ELECTRON_RUN_AS_NODE.
 * Bind HOST is always 0.0.0.0; ADVERTISE_HOST is QR/join only (never bind).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server/index.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.env.CLIENT_DIST = process.env.CLIENT_DIST || path.join(rootDir, 'client');
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3001';

const started = await startServer({
  port: Number(process.env.PORT),
  host: process.env.HOST,
  clientDist: process.env.CLIENT_DIST,
  advertiseHost: process.env.ADVERTISE_HOST || process.env.ADVERTISE_BASE || null,
  logger: true,
});

console.log(JSON.stringify({
  ready: true,
  localAdminUrl: started.localAdminUrl,
  advertiseBase: started.advertiseBase,
  lanUrls: started.lanUrls,
  port: started.port,
  advertiseError: started.advertiseError ?? null,
}));
`,
);

console.log('Embed ready at', embed);
