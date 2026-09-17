/**
 * Prepares host/embed with production server + SPA + pruned deps
 * for Electron portable packaging (Win / Linux AppImage / macOS).
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
execSync('npm install --omit=dev --no-package-lock', {
  cwd: embed,
  stdio: 'inherit',
});

fs.writeFileSync(
  path.join(embed, 'run.mjs'),
  `/**
 * Portable entry — used by Electron via ELECTRON_RUN_AS_NODE.
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
