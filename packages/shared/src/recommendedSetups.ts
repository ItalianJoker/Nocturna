/**
 * @fileoverview Player-count recommended decks for lobby Host one-tap apply.
 *
 * Presets use only original Nocturna role ids from `defaultRoles.ts`.
 */

import type { RoleDefinition } from './types.js';
import { applyRoleCounts } from './defaultRoles.js';

export interface RecommendedSetup {
  /** Stable id for i18n keys `lobby.recommended.<id>.*`. */
  id: string;
  /** Inclusive player range (non-master seats the Host expects). */
  minPlayers: number;
  maxPlayers: number;
  /** roleId → copies */
  counts: Record<string, number>;
}

/**
 * Balanced starter tables. Counts ignore a seated Master (Host should subtract
 * one if playing ASSISTED with a non-playing Master).
 */
export const RECOMMENDED_SETUPS: RecommendedSetup[] = [
  {
    id: 'table6',
    minPlayers: 6,
    maxPlayers: 6,
    counts: {
      cittadino: 3,
      guardia: 1,
      oracolo: 1,
      ombra: 1,
    },
  },
  {
    id: 'table7',
    minPlayers: 7,
    maxPlayers: 7,
    counts: {
      cittadino: 3,
      guardia: 1,
      oracolo: 1,
      ombra: 2,
    },
  },
  {
    id: 'table8',
    minPlayers: 8,
    maxPlayers: 8,
    counts: {
      cittadino: 4,
      guardia: 1,
      oracolo: 1,
      ombra: 2,
    },
  },
  {
    id: 'table9',
    minPlayers: 9,
    maxPlayers: 9,
    counts: {
      cittadino: 3,
      guardia: 1,
      oracolo: 1,
      eco: 1,
      ombra: 2,
      vagabondo: 1,
    },
  },
  {
    id: 'table10',
    minPlayers: 10,
    maxPlayers: 10,
    counts: {
      cittadino: 4,
      guardia: 1,
      baluardo: 1,
      oracolo: 1,
      ombra: 2,
      vagabondo: 1,
    },
  },
  {
    id: 'table12',
    minPlayers: 11,
    maxPlayers: 12,
    counts: {
      cittadino: 4,
      guardia: 1,
      oracolo: 1,
      lunavista: 1,
      eco: 1,
      ombra: 2,
      caccianotte: 1,
      vagabondo: 1,
    },
  },
  {
    id: 'table14',
    minPlayers: 13,
    maxPlayers: 16,
    counts: {
      cittadino: 5,
      guardia: 1,
      baluardo: 1,
      oracolo: 1,
      lunavista: 1,
      eco: 1,
      ombra: 2,
      caccianotte: 1,
      simulacro: 1,
      artiglio: 1,
      vagabondo: 1,
    },
  },
];

export function deckFromRecommended(setup: RecommendedSetup): RoleDefinition[] {
  return applyRoleCounts(setup.counts);
}

/**
 * Best matching preset for a live player count (non-master). Falls back to
 * nearest band; never returns undefined when the catalog is non-empty.
 */
export function pickRecommendedForPlayerCount(
  playerCount: number,
): RecommendedSetup {
  const n = Math.max(1, Math.floor(playerCount));
  const exact = RECOMMENDED_SETUPS.find(
    (s) => n >= s.minPlayers && n <= s.maxPlayers,
  );
  if (exact) return exact;
  let best = RECOMMENDED_SETUPS[0]!;
  let bestDist = Infinity;
  for (const s of RECOMMENDED_SETUPS) {
    const mid = (s.minPlayers + s.maxPlayers) / 2;
    const dist = Math.abs(mid - n);
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}
