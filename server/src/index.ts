/**
 * @fileoverview Nocturna HTTP + Socket.io entrypoint.
 *
 * Fastify serves the built React SPA (production) and a health endpoint.
 * Socket.io is attached to the same HTTP server with connection state
 * recovery so smartphone lock-screen / Wi-Fi↔4G blips can resume within
 * two minutes without forcing a full lobby rejoin.
 *
 * Path resolution supports Docker (`/app/...`), monorepo dev, and the
 * portable Electron host embed layout via `CLIENT_DIST` / `NOCTURNA_ROOT`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@nocturna/shared';
import { registerSocketHandlers } from './socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface StartServerOptions {
  port?: number;
  host?: string;
  clientDist?: string;
  corsOrigin?: boolean | string | string[];
  logger?: boolean;
}

export interface StartedServer {
  port: number;
  host: string;
  url: string;
  lanUrls: string[];
  close: () => Promise<void>;
}

function resolveClientDist(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (process.env.CLIENT_DIST) return path.resolve(process.env.CLIENT_DIST);
  if (process.env.NOCTURNA_ROOT) {
    return path.resolve(process.env.NOCTURNA_ROOT, 'client');
  }
  // Monorepo: server/dist → ../../client/dist
  const monorepo = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(monorepo)) return monorepo;
  // Portable embed: <resources>/embed/server → ../client
  const embed = path.resolve(__dirname, '../client');
  if (fs.existsSync(embed)) return embed;
  return monorepo;
}

/**
 * Starts the authoritative Nocturna HTTP + Socket.io stack.
 * Used by CLI (`node dist/index.js`), Docker, and the portable Host app.
 */
export async function startServer(
  options: StartServerOptions = {},
): Promise<StartedServer> {
  const PORT = options.port ?? Number(process.env.PORT ?? 3001);
  const HOST = options.host ?? process.env.HOST ?? '0.0.0.0';
  const CLIENT_ORIGIN =
    options.corsOrigin ??
    (process.env.CLIENT_ORIGIN === 'false'
      ? false
      : process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== 'true'
        ? process.env.CLIENT_ORIGIN
        : true);

  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, {
    origin: CLIENT_ORIGIN,
  });

  app.get('/api/health', async () => ({
    ok: true,
    name: 'Nocturna',
    tagline: 'Chi dorme non sopravvive',
    now: Date.now(),
  }));

  app.get('/api/host-info', async () => ({
    ok: true,
    port: PORT,
    lanUrls: collectLanUrls(PORT),
  }));

  const clientDist = resolveClientDist(options.clientDist);
  const servingSpa = fs.existsSync(clientDist);

  if (servingSpa) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  await app.listen({ port: PORT, host: HOST });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(app.server, {
    cors: {
      origin: CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
    /**
     * Tolerates temporary smartphone lock-screens and network handovers.
     * After `maxDisconnectionDuration` the recovery buffer is dropped and
     * the client must rebind via `session:rebind` + sessionToken.
     */
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  registerSocketHandlers(io);

  const lanUrls = collectLanUrls(PORT);
  app.log.info(
    `Nocturna listening on http://${HOST}:${PORT}` +
      (servingSpa
        ? ` (SPA from ${clientDist})`
        : ' (API only — run Vite for UI)'),
  );
  if (lanUrls.length) {
    app.log.info(`LAN: ${lanUrls.join(', ')}`);
  }

  return {
    port: PORT,
    host: HOST,
    url: `http://127.0.0.1:${PORT}`,
    lanUrls,
    close: async () => {
      io.close();
      await app.close();
    },
  };
}

function collectLanUrls(port: number): string[] {
  const urls: string[] = [];
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

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
