/**
 * @fileoverview LAN advertise helpers for Nocturna join/QR URLs.
 *
 * Hard rule: never advertise loopback (`localhost`, `127.0.0.1`, `::1`) in
 * QR codes or share links — phones on the table cannot reach the Host that way.
 */

/** Hostnames / literals that must never appear in player-facing join URLs. */
const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
]);

export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (LOOPBACK_HOSTS.has(h) || LOOPBACK_HOSTS.has(host.trim().toLowerCase())) {
    return true;
  }
  if (h.startsWith('127.')) return true;
  return false;
}

export function isPrivateLanIpv4(ip: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // Link-local (often phone hotspot / APIPA) — usable on LAN segments.
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Preference order for advertised NIC addresses:
 * 1. RFC1918 private (10/8, 172.16–31, 192.168)
 * 2. Other non-internal IPv4 (rare public NIC)
 * Never returns loopback.
 */
export function pickPreferredLanIp(candidates: string[]): string | null {
  const clean = candidates.filter((ip) => ip && !isLoopbackHost(ip));
  const privateFirst = clean.filter(isPrivateLanIpv4);
  if (privateFirst.length) return privateFirst[0]!;
  return clean[0] ?? null;
}

export interface AdvertiseInfo {
  port: number;
  /** All non-loopback IPv4 addresses on the Host. */
  lanIps: string[];
  /** Preferred single IP for QR (null if none). */
  preferredIp: string | null;
  /**
   * Fully qualified join base (no path/query), e.g. `http://192.168.1.12:3001`.
   * Null when only loopback is available and no override was set.
   */
  advertiseBase: string | null;
  /** True when override came from env/CLI/Host setting. */
  usedOverride: boolean;
  /** Human-readable reason when advertiseBase is null. */
  error?: string;
}

/**
 * Builds the player-facing advertise base URL.
 *
 * @param port - Listening port (must match the bound server).
 * @param lanIps - Non-loopback IPs discovered on the Host.
 * @param overrideBaseOrHost - Full base `http://host:port` or bare hostname/IP.
 */
export function buildAdvertiseInfo(
  port: number,
  lanIps: string[],
  overrideBaseOrHost?: string | null,
): AdvertiseInfo {
  const filtered = lanIps.filter((ip) => !isLoopbackHost(ip));
  const preferredIp = pickPreferredLanIp(filtered);

  const override = overrideBaseOrHost?.trim();
  if (override) {
    try {
      const asUrl = override.includes('://')
        ? new URL(override)
        : new URL(`http://${override}`);
      if (isLoopbackHost(asUrl.hostname)) {
        return {
          port,
          lanIps: filtered,
          preferredIp,
          advertiseBase: null,
          usedOverride: true,
          error:
            'Advertise override points at loopback — phones cannot join. Use a LAN IP or hostname.',
        };
      }
      if (!asUrl.port) asUrl.port = String(port);
      // Strip path/query/hash — join links append ?pin= themselves.
      asUrl.pathname = '';
      asUrl.search = '';
      asUrl.hash = '';
      const base = asUrl.toString().replace(/\/$/, '');
      return {
        port,
        lanIps: filtered,
        preferredIp,
        advertiseBase: base,
        usedOverride: true,
      };
    } catch {
      return {
        port,
        lanIps: filtered,
        preferredIp,
        advertiseBase: null,
        usedOverride: true,
        error: 'Invalid advertise override. Expected host or http://host:port.',
      };
    }
  }

  if (!preferredIp) {
    return {
      port,
      lanIps: filtered,
      preferredIp: null,
      advertiseBase: null,
      usedOverride: false,
      error:
        'No LAN IP found (only loopback). Connect to Wi‑Fi or set ADVERTISE_HOST / Host override.',
    };
  }

  return {
    port,
    lanIps: filtered,
    preferredIp,
    advertiseBase: `http://${preferredIp}:${port}`,
    usedOverride: false,
  };
}

/**
 * Validates a candidate join URL for QR encoding.
 * Returns an error string if the URL is unsafe for phones.
 */
export function validateJoinUrlForQr(url: string): string | null {
  try {
    const u = new URL(url);
    if (isLoopbackHost(u.hostname)) {
      return 'Join URL uses loopback — refused for QR.';
    }
    return null;
  } catch {
    return 'Join URL is not a valid absolute URL.';
  }
}
