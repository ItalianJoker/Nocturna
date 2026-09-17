/**
 * @fileoverview Fetches `/api/host-info` for LAN advertise / QR URLs.
 *
 * Never builds join links from loopback `window.location` — phones cannot
 * reach the Host that way. Falls back only when the current page host is
 * already a non-loopback address (player already on LAN URL).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  buildAdvertiseInfo,
  isLoopbackHost,
  validateJoinUrlForQr,
} from '@nocturna/shared';

export interface HostInfoResponse {
  ok: boolean;
  port: number;
  lanIps: string[];
  preferredIp: string | null;
  lanUrls: string[];
  advertiseBase: string | null;
  usedOverride: boolean;
  error: string | null;
}

export interface JoinAdvertise {
  loading: boolean;
  /** Absolute base without path, e.g. http://192.168.1.10:3001 */
  base: string | null;
  port: number | null;
  error: string | null;
  refresh: () => void;
}

function pageNonLoopbackBase(): string | null {
  if (typeof window === 'undefined') return null;
  if (isLoopbackHost(window.location.hostname)) return null;
  return `${window.location.protocol}//${window.location.host}`;
}

export function useJoinAdvertise(): JoinAdvertise {
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/host-info', { cache: 'no-store' });
        if (!res.ok) throw new Error(`host-info ${res.status}`);
        const data = (await res.json()) as HostInfoResponse;
        setPort(data.port);
        if (data.advertiseBase) {
          const bad = validateJoinUrlForQr(data.advertiseBase);
          if (bad) {
            setBase(null);
            setError(bad);
          } else {
            setBase(data.advertiseBase.replace(/\/$/, ''));
            setError(null);
          }
          return;
        }
        // Dev: Vite on :5173 proxying API — prefer server LAN, else refuse loopback page.
        const pageBase = pageNonLoopbackBase();
        if (pageBase && data.port) {
          // If SPA is served from LAN already, keep that host but sync port from server.
          try {
            const u = new URL(pageBase);
            u.port = String(data.port);
            const candidate = u.toString().replace(/\/$/, '');
            if (!validateJoinUrlForQr(candidate)) {
              setBase(candidate);
              setError(null);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        const rebuilt = buildAdvertiseInfo(
          data.port,
          data.lanIps ?? [],
          null,
        );
        setBase(rebuilt.advertiseBase);
        setError(rebuilt.error ?? data.error);
      } catch (e) {
        const pageBase = pageNonLoopbackBase();
        if (pageBase) {
          setBase(pageBase);
          setError(null);
        } else {
          setBase(null);
          setError(
            e instanceof Error
              ? e.message
              : 'Could not resolve LAN advertise URL',
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, base, port, error, refresh };
}

/** Builds `http://lan:port/?pin=NNNNNN` — never loopback. */
export function buildJoinUrl(advertiseBase: string, roomId: string): string {
  const u = new URL(advertiseBase);
  if (isLoopbackHost(u.hostname)) {
    throw new Error('Refusing to build join URL with loopback host');
  }
  u.searchParams.set('pin', roomId);
  return u.toString();
}
