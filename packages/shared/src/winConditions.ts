/**
 * @fileoverview Win-condition evaluation for Nocturna.
 *
 * Evaluated exclusively on the server after dawn resolution and after tribunal
 * eliminations. Clients only render the `ending` block from sanitised state.
 */

import type { Faction, Player, RoleDefinition, RoleId } from './types.js';

export interface WinCheckResult {
  terminal: boolean;
  winningFaction: Faction | 'NONE' | null;
  winningPlayerIds: string[];
  summary: string;
}

function roleOf(
  player: Player,
  roles: Map<RoleId, RoleDefinition>,
): RoleDefinition | undefined {
  if (!player.roleId) return undefined;
  return roles.get(player.roleId);
}

/**
 * Counts alive non-master players by faction.
 */
export function countAliveByFaction(
  players: Player[],
  roles: RoleDefinition[],
): Record<Faction, number> {
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const counts: Record<Faction, number> = {
    VILLAGE: 0,
    IMPOSTORS: 0,
    NEUTRAL: 0,
    SOLO: 0,
  };
  for (const p of players) {
    if (!p.isAlive || p.isMaster) continue;
    const role = roleOf(p, roleMap);
    if (!role) continue;
    counts[role.faction] += 1;
  }
  return counts;
}

/**
 * Determines whether the game has reached a terminal state.
 *
 * Priority of checks:
 * 1. No impostors left → Villaggio wins (everyone with ELIMINATE_ALL_IMPOSTORS).
 * 2. Impostors ≥ villagers (alive) → Ombre win.
 * 3. Exactly one alive non-master with LAST_SURVIVOR → that solo wins.
 * 4. Zero alive players → draw (`NONE`).
 */
export function evaluateWinConditions(
  players: Player[],
  roles: RoleDefinition[],
): WinCheckResult {
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const alive = players.filter((p) => p.isAlive && !p.isMaster);
  const counts = countAliveByFaction(players, roles);

  if (alive.length === 0) {
    return {
      terminal: true,
      winningFaction: 'NONE',
      winningPlayerIds: [],
      summary: 'Nessun sopravvissuto. Pareggio.',
    };
  }

  if (counts.IMPOSTORS === 0) {
    const winners = alive
      .filter((p) => {
        const r = roleOf(p, roleMap);
        return (
          r?.winCondition === 'ELIMINATE_ALL_IMPOSTORS' ||
          r?.faction === 'VILLAGE'
        );
      })
      .map((p) => p.id);
    return {
      terminal: true,
      winningFaction: 'VILLAGE',
      winningPlayerIds: winners,
      summary: 'Le Ombre sono state eliminate. Il Villaggio sopravvive.',
    };
  }

  if (counts.IMPOSTORS >= counts.VILLAGE) {
    const winners = alive
      .filter((p) => roleOf(p, roleMap)?.faction === 'IMPOSTORS')
      .map((p) => p.id);
    return {
      terminal: true,
      winningFaction: 'IMPOSTORS',
      winningPlayerIds: winners,
      summary: 'Le Ombre eguagliano o superano il Villaggio. La notte ha vinto.',
    };
  }

  if (alive.length === 1) {
    const sole = alive[0]!;
    const role = roleOf(sole, roleMap);
    if (role?.winCondition === 'LAST_SURVIVOR') {
      return {
        terminal: true,
        winningFaction: role.faction,
        winningPlayerIds: [sole.id],
        summary: `${sole.displayName} (${role.name}) è l'unico sopravvissuto.`,
      };
    }
  }

  // CUSTOM_SURVIVE holders win only when checked at a terminal village/impostor
  // outcome — handled above by inclusion when appropriate. No early terminal.
  return {
    terminal: false,
    winningFaction: null,
    winningPlayerIds: [],
    summary: '',
  };
}
