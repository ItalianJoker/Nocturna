/**
 * @fileoverview Atomic night-action resolution for Nocturna.
 *
 * Pending actions accumulate during the night and are flushed exactly once
 * at the NIGHT → DAWN transition. Applying effects immediately would create
 * order-dependent bugs and leak information through intermediate states.
 *
 * Formal precedence (see `RESOLUTION_ORDER`):
 * 1. PROTECTION — shields / immunities land first.
 * 2. INVESTIGATION — reads the pre-attack board (protected flags visible,
 *    deaths not yet applied) so intel stays consistent with narrative timing.
 * 3. ATTACK — lethal hits; cancelled when the target is protected.
 * 4. DELAYED — curses, soft role swaps, etc., after combat settles.
 *
 * Within a band, actions sort by ascending `priority`, then by `submittedAt`.
 */

import type {
  PendingAction,
  Player,
  PlayerId,
  ResolutionBand,
  ResolutionResult,
  ResolvedActionLog,
  RoleDefinition,
} from './types.js';

/** Band execution order — index 0 runs first. */
export const RESOLUTION_ORDER: ResolutionBand[] = [
  'PROTECTION',
  'INVESTIGATION',
  'ATTACK',
  'DELAYED',
];

/**
 * Deep-clones players so resolution is referentially pure aside from the
 * returned result (callers replace their map from `result.players`).
 */
function clonePlayers(players: Player[]): Player[] {
  return players.map((p) => ({ ...p }));
}

function playerById(
  players: Player[],
  id: PlayerId | null,
): Player | undefined {
  if (!id) return undefined;
  return players.find((p) => p.id === id);
}

function sortBand(actions: PendingAction[]): PendingAction[] {
  return [...actions].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.submittedAt - b.submittedAt;
  });
}

function factionLabel(faction: string | null | undefined): string {
  switch (faction) {
    case 'VILLAGE':
      return 'Villaggio';
    case 'IMPOSTORS':
      return 'Ombre';
    case 'NEUTRAL':
      return 'Neutrali';
    case 'SOLO':
      return 'Solitari';
    default:
      return 'Sconosciuto';
  }
}

/**
 * Resolves the winner of a faction vote map (voterId → targetId).
 * Ties break by earliest submission order among the tied targets as they
 * appear in the vote values (stable, deterministic). Null votes ignored.
 */
export function tallyFactionVotes(
  votes: Record<PlayerId, PlayerId> | undefined,
): PlayerId | null {
  if (!votes) return null;
  const counts = new Map<PlayerId, number>();
  const firstSeen: PlayerId[] = [];
  for (const target of Object.values(votes)) {
    if (!target) continue;
    if (!counts.has(target)) firstSeen.push(target);
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  if (firstSeen.length === 0) return null;
  let best = firstSeen[0]!;
  let bestCount = counts.get(best) ?? 0;
  for (const id of firstSeen.slice(1)) {
    const c = counts.get(id) ?? 0;
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Applies all queued night actions onto a player snapshot.
 *
 * @param actions - Pending actions accumulated during the night (null actions skipped).
 * @param players - Current authoritative player list (masters included but inert).
 * @param roles - Deck used to interpret inspect depth / role names in logs.
 * @returns Elimination set, saves, private investigation payloads, audit logs,
 *          and the mutated player array (protections cleared after use).
 */
export function resolveNightActions(
  actions: PendingAction[],
  players: Player[],
  roles: RoleDefinition[] = [],
): ResolutionResult {
  const board = clonePlayers(players);
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const logs: ResolvedActionLog[] = [];
  const eliminated = new Set<PlayerId>();
  const saved = new Set<PlayerId>();
  const investigationResults: ResolutionResult['investigationResults'] = [];

  // Clear ephemeral marks from any previous partial run (should already be clean).
  for (const p of board) {
    p.markedForDeath = false;
  }

  const actionable = actions.filter((a) => !a.isNullAction);

  for (const band of RESOLUTION_ORDER) {
    const bandActions = sortBand(
      actionable.filter((a) => a.resolutionBand === band),
    );

    for (const action of bandActions) {
      switch (band) {
        case 'PROTECTION': {
          const target = playerById(board, action.targetPlayerId);
          if (!target || !target.isAlive) {
            logs.push({
              actionId: action.id,
              band,
              actorPlayerId: action.actorPlayerId,
              actorRoleId: action.actorRoleId,
              targetPlayerId: action.targetPlayerId,
              summary: 'Protezione senza bersaglio valido — nessun effetto.',
            });
            break;
          }
          target.isProtected = true;
          logs.push({
            actionId: action.id,
            band,
            actorPlayerId: action.actorPlayerId,
            actorRoleId: action.actorRoleId,
            targetPlayerId: target.id,
            summary: `Protezione applicata a ${target.displayName}.`,
          });
          break;
        }
        case 'INVESTIGATION': {
          const target = playerById(board, action.targetPlayerId);
          if (!target || !target.isAlive) {
            logs.push({
              actionId: action.id,
              band,
              actorPlayerId: action.actorPlayerId,
              actorRoleId: action.actorRoleId,
              targetPlayerId: action.targetPlayerId,
              summary: 'Investigazione senza bersaglio valido.',
            });
            break;
          }
          const actorRole = roleMap.get(action.actorRoleId);
          const targetRole = target.roleId
            ? roleMap.get(target.roleId)
            : undefined;
          const revealed =
            actorRole?.inspectReveals === 'ROLE'
              ? (targetRole?.name ?? 'Ruolo sconosciuto')
              : factionLabel(targetRole?.faction ?? null);

          investigationResults.push({
            actorPlayerId: action.actorPlayerId,
            targetPlayerId: target.id,
            revealed,
          });
          logs.push({
            actionId: action.id,
            band,
            actorPlayerId: action.actorPlayerId,
            actorRoleId: action.actorRoleId,
            targetPlayerId: target.id,
            summary: `Investigazione su ${target.displayName}: ${revealed}.`,
            inspectResult: {
              targetPlayerId: target.id,
              revealed,
            },
          });
          break;
        }
        case 'ATTACK': {
          let targetId = action.targetPlayerId;
          if (action.actionType === 'FACTION_VOTE') {
            targetId = tallyFactionVotes(action.factionVotes) ?? targetId;
          }
          const target = playerById(board, targetId);
          if (!target || !target.isAlive) {
            logs.push({
              actionId: action.id,
              band,
              actorPlayerId: action.actorPlayerId,
              actorRoleId: action.actorRoleId,
              targetPlayerId: targetId,
              summary: 'Attacco senza bersaglio valido — nessun effetto.',
            });
            break;
          }
          if (target.isProtected) {
            saved.add(target.id);
            logs.push({
              actionId: action.id,
              band,
              actorPlayerId: action.actorPlayerId,
              actorRoleId: action.actorRoleId,
              targetPlayerId: target.id,
              summary: `Attacco su ${target.displayName} fallito: bersaglio protetto.`,
            });
            break;
          }
          target.markedForDeath = true;
          logs.push({
            actionId: action.id,
            band,
            actorPlayerId: action.actorPlayerId,
            actorRoleId: action.actorRoleId,
            targetPlayerId: target.id,
            summary: `Attacco riuscito su ${target.displayName}.`,
          });
          break;
        }
        case 'DELAYED': {
          // Soft / narrative effects: currently logged as acknowledged.
          // Role-swap or curse modules can extend this band without touching
          // protection / attack ordering.
          logs.push({
            actionId: action.id,
            band,
            actorPlayerId: action.actorPlayerId,
            actorRoleId: action.actorRoleId,
            targetPlayerId: action.targetPlayerId,
            summary: action.targetPlayerId
              ? `Effetto ritardato registrato su bersaglio ${action.targetPlayerId}.`
              : 'Effetto ritardato senza bersaglio.',
          });
          break;
        }
        default: {
          const _exhaustive: never = band;
          void _exhaustive;
        }
      }
    }
  }

  // Commit deaths and clear spent protections so dawn starts clean.
  for (const p of board) {
    if (p.markedForDeath && p.isAlive) {
      p.isAlive = false;
      eliminated.add(p.id);
    }
    p.markedForDeath = false;
    p.isProtected = false;
  }

  return {
    eliminatedPlayerIds: [...eliminated],
    savedPlayerIds: [...saved],
    investigationResults,
    logs,
    players: board,
  };
}
