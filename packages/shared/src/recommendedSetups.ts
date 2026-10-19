/**
 * @fileoverview Player-count recommended decks (6–24) for lobby Host apply.
 *
 * Balance rules of thumb (documented for maintainers / PR notes):
 * - Pack hunters ≈ 1 per 5 seats (~20%), matching classic live-table ratios
 *   from community rule pages (inspiration only — not commercial copy).
 * - Never let shadow power ≥ village seats at deal (auto-lose).
 * - Always ≥1 Custode + ≥1 investigator (Oracolo and/or Giudice/Soglia).
 * - Village lethal (Mannaia / inquisitor-like cleave) only at 16+ and ≤1.
 * - Dual-face Crepuscolo (Hyde-like *function*) is solo-win, first-night listen.
 * - Simulacro / solo neutrals appear mid–large so small tables stay readable.
 * - Fill remainder with Cittadino so total copies === player count.
 */

import type { RoleDefinition } from './types.js';
import { deckFromCounts } from './defaultRoles.js';

export interface RecommendedSetup {
  /** Stable id for i18n keys `lobby.recommended.<id>.*`. */
  id: string;
  /** Inclusive player range (non-master seats). */
  minPlayers: number;
  maxPlayers: number;
  /** roleId → copies */
  counts: Record<string, number>;
}

/** Pack hunters (Ombra + Caccianotte): ~1 per 5 seats (rounded), min 1. */
function hunterSeats(n: number): number {
  if (n <= 6) return 1;
  return Math.max(1, Math.round(n / 5));
}

/**
 * Build a balanced count map for exactly `n` dealt seats.
 */
export function buildBalancedCounts(n: number): Record<string, number> {
  const seats = Math.max(6, Math.min(24, Math.floor(n)));
  const counts: Record<string, number> = {};
  const add = (id: string, c: number) => {
    if (c <= 0) return;
    counts[id] = (counts[id] ?? 0) + c;
  };

  const hunters = hunterSeats(seats);
  // Split hunters between Ombra and Caccianotte (same vote pool).
  if (hunters === 1) {
    add('ombra', 1);
  } else if (hunters === 2) {
    add('ombra', 2);
  } else if (hunters === 3) {
    add('ombra', 2);
    add('caccianotte', 1);
  } else if (hunters === 4) {
    add('ombra', 3);
    add('caccianotte', 1);
  } else {
    add('ombra', 3);
    add('caccianotte', 2);
  }

  // Core village powers
  add('guardia', 1);
  add('oracolo', 1);

  // Escalating village / special seats
  if (seats >= 9) add('eco', 1);
  if (seats >= 10) add('baluardo', 1);
  if (seats >= 11) add('lunavista', 1);
  if (seats >= 12) add('soglia', 1);
  if (seats >= 13) add('vagabondo', 1);
  if (seats >= 14) add('giudice_notte', 1);
  if (seats >= 15) add('simulacro', 1);
  if (seats >= 16) add('mannaia', 1);
  if (seats >= 17) add('corvo', 1);
  if (seats >= 18) {
    add('legame', 2);
  }
  if (seats >= 19) add('crepuscolo', 1);
  if (seats >= 20) add('artiglio', 1);
  if (seats >= 21) add('veglia', 1);
  if (seats >= 22) add('fiamma_fredda', 1);
  if (seats >= 23) add('crocevia', 1);
  if (seats >= 24) add('invocatore', 1);

  const used = Object.values(counts).reduce((a, b) => a + b, 0);
  const citizens = seats - used;
  if (citizens < 0) {
    throw new Error(
      `recommended setup for ${seats} over-allocated by ${-citizens}`,
    );
  }
  add('cittadino', citizens);

  // Safety: hunters must stay below village-aligned living potential at start.
  const shadowPower =
    (counts.ombra ?? 0) +
    (counts.caccianotte ?? 0) +
    (counts.artiglio ?? 0) +
    (counts.fiamma_fredda ?? 0) +
    (counts.simulacro ?? 0);
  if (shadowPower >= seats - shadowPower) {
    throw new Error(
      `recommended setup for ${seats}: shadow density too high (${shadowPower}/${seats})`,
    );
  }

  return counts;
}

function setupForCount(n: number): RecommendedSetup {
  return {
    id: `table${n}`,
    minPlayers: n,
    maxPlayers: n,
    counts: buildBalancedCounts(n),
  };
}

/** One preset per seat count from 6 through 24. */
export const RECOMMENDED_SETUPS: RecommendedSetup[] = Array.from(
  { length: 19 },
  (_, i) => setupForCount(i + 6),
);

/**
 * Active party deck for a recommended setup: only roles with count ≥ 1.
 * Catalog roles left at 0 are omitted so they stay available via
 * Partita Personalizzata → “add missing role”.
 */
export function deckFromRecommended(setup: RecommendedSetup): RoleDefinition[] {
  return deckFromCounts(setup.counts);
}

/**
 * Best matching preset for a live player count (non-master).
 */
export function pickRecommendedForPlayerCount(
  playerCount: number,
): RecommendedSetup {
  const n = Math.max(6, Math.min(24, Math.floor(playerCount)));
  const exact = RECOMMENDED_SETUPS.find(
    (s) => n >= s.minPlayers && n <= s.maxPlayers,
  );
  return exact ?? RECOMMENDED_SETUPS[0]!;
}

/** Human-readable balance blurb for store / PR (English). */
export const RECOMMENDED_BALANCE_NOTES = `
Pack hunters ≈ 1 per 5 seats (~20%); never shadow majority at deal.
Always Custode + Oracolo; Lunavista/Soglia/Giudice scale in from 11–14.
Village Mannaia 16+ (one cleaver = inquisitor-like strike). Simulacro 15+.
Crepuscolo 19+ (dual-face solo; first-night listen). Legame pair 18+.
Artiglio / Fiamma Fredda only on large tables. Presets: exact seat totals 6–24.
`.trim();
