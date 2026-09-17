/**
 * @fileoverview Nocturna HTTP + Socket.io entrypoint.
 *
 * Fastify serves the built React SPA (production) and a health endpoint.
 * Socket.io is attached to the same HTTP server with connection state
 * recovery so smartphone lock-screen / Wi-Fi↔4G blips can resume within
 * two minutes without forcing a full lobby rejoin.
 *
 * Listen host defaults to `0.0.0.0`. Join/QR advertisement never uses
 * loopback — see `/api/host-info` and `@nocturna/shared` lanAdvertise helpers.
 *
 * Port is configurable via `PORT` env, `--port` CLI, or Host app settings.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import {
  buildAdvertiseInfo,
  DEFAULT_SERVER_PORT,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from '@nocturna/shared';
import { registerSocketHandlers } from './socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface StartServerOptions {
  port?: number;
  host?: string;
  clientDist?: string;
  corsOrigin?: boolean | string | string[];
  logger?: boolean;
  /** Hostname, IP, or full `http://host:port` for QR/join advertisement. */
  advertiseHost?: string | null;
}

export interface StartedServer {
  port: number;
  host: string;
  /** Loopback admin URL for Host machine health checks only — never for QR. */
  localAdminUrl: string;
  lanUrls: string[];
  advertiseBase: string | null;
  advertiseError?: string;
  close: () => Promise<void>;
}

function resolveClientDist(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (process.env.CLIENT_DIST) return path.resolve(process.env.CLIENT_DIST);
  if (process.env.NOCTURNA_ROOT) {
    return path.resolve(process.env.NOCTURNA_ROOT, 'client');
  }
  const monorepo = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(monorepo)) return monorepo;
  const embed = path.resolve(__dirname, '../client');
  if (fs.existsSync(embed)) return embed;
  return monorepo;
}

function collectLanIps(): string[] {
  const ips: string[] = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): {
  port?: number;
  host?: string;
  advertiseHost?: string;
} {
  const out: { port?: number; host?: string; advertiseHost?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if ((a === '--port' || a === '-p') && next) {
      out.port = Number(next);
      i++;
    } else if (a.startsWith('--port=')) {
      out.port = Number(a.slice('--port='.length));
    } else if (a === '--host' && next) {
      out.host = next;
      i++;
    } else if (a === '--advertise-host' && next) {
      out.advertiseHost = next;
      i++;
    } else if (a.startsWith('--advertise-host=')) {
      out.advertiseHost = a.slice('--advertise-host='.length);
    }
  }
  return out;
}

/**
 * Starts the authoritative Nocturna HTTP + Socket.io stack.
 * Used by CLI (`node dist/index.js`), Docker, and the portable Host app.
 */
export async function startServer(
  options: StartServerOptions = {},
): Promise<StartedServer> {
  const cli = parseCliArgs();
  const PORT =
    options.port ??
    cli.port ??
    Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
  const HOST = options.host ?? cli.host ?? process.env.HOST ?? '0.0.0.0';
  const advertiseOverride =
    options.advertiseHost ??
    cli.advertiseHost ??
    process.env.ADVERTISE_BASE ??
    process.env.ADVERTISE_HOST ??
    null;

  if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT: ${PORT}`);
  }

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

  const lanIps = collectLanIps();
  const advertise = buildAdvertiseInfo(PORT, lanIps, advertiseOverride);

  app.get('/api/health', async () => ({
    ok: true,
    name: 'Nocturna',
    tagline: 'Chi dorme non sopravvive',
    now: Date.now(),
    port: PORT,
  }));

  /**
   * Player-facing Host discovery. Clients MUST build QR/join links from
   * `advertiseBase` — never from window.location when it is loopback.
   */
  app.get('/api/host-info', async () => ({
    ok: true,
    port: PORT,
    listenHost: HOST,
    lanIps: advertise.lanIps,
    preferredIp: advertise.preferredIp,
    lanUrls: advertise.lanIps.map((ip) => `http://${ip}:${PORT}`),
    advertiseBase: advertise.advertiseBase,
    usedOverride: advertise.usedOverride,
    error: advertise.error ?? null,
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
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  registerSocketHandlers(io);

  app.log.info(
    `Nocturna listening on http://${HOST}:${PORT}` +
      (servingSpa
        ? ` (SPA from ${clientDist})`
        : ' (API only — run Vite for UI)'),
  );
  if (advertise.advertiseBase) {
    app.log.info(`Advertise (QR/join): ${advertise.advertiseBase}`);
  } else {
    app.log.warn(
      advertise.error ??
        'No LAN advertise URL — QR join will fail until a NIC or ADVERTISE_HOST is available.',
    );
  }

  return {
    port: PORT,
    host: HOST,
    localAdminUrl: `http://127.0.0.1:${PORT}`,
    lanUrls: advertise.lanIps.map((ip) => `http://${ip}:${PORT}`),
    advertiseBase: advertise.advertiseBase,
    advertiseError: advertise.error,
    close: async () => {
      io.close();
      await app.close();
    },
  };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
