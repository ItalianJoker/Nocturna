/**
 * @fileoverview Server-synced countdown hook.
 *
 * Uses `phaseEndsAt` from the server rather than a local duration so every
 * phone shows the same remaining time despite render jitter.
 */

import { useEffect, useState } from 'react';

export function useServerCountdown(
  phaseEndsAt: number | null | undefined,
  serverNow: number | null | undefined,
): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!phaseEndsAt) {
      setRemaining(0);
      return;
    }
    const drift = serverNow ? Date.now() - serverNow : 0;
    const tick = () => {
      const left = Math.max(0, phaseEndsAt - (Date.now() - drift));
      setRemaining(left);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phaseEndsAt, serverNow]);

  return remaining;
}

export function formatMs(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
