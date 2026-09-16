/**
 * @fileoverview Night turn scheduler for Nocturna.
 *
 * Builds an ordered micro-turn queue for a single night based on:
 * - which roles are still alive (non-master),
 * - each role's `WakeSchedule.frequency` relative to `nightNumber`,
 * - ascending `priority` (call order),
 * - action type aggregation for `FACTION_VOTE` (one shared turn per faction).
 *
 * Why we build the full queue up-front:
 * - AUTOMATED mode needs deterministic durations for timing-attack masking.
 * - ASSISTED mode shows the Master the entire stepper without re-deriving it.
 * - ON_TRIGGER roles are intentionally omitted here; the Master (or another
 *   effect) must inject them explicitly so they never leak via automatic calls.
 */

import type {
  ActionType,
  Faction,
  Player,
  ResolutionBand,
  RoleDefinition,
  RoleId,
  ScheduledTurn,
  WakeFrequency,
  WakeSchedule,
} from './types.js';

/**
 * Returns true when the given wake frequency should fire on `nightNumber`
 * (1-indexed). `ON_TRIGGER` always returns false — those wakes are opt-in.
 */
export function shouldWakeOnNight(
  frequency: WakeFrequency,
  nightNumber: number,
): boolean {
  switch (frequency) {
    case 'FIRST_NIGHT_ONLY':
      return nightNumber === 1;
    case 'EVERY_NIGHT':
      return nightNumber >= 1;
    case 'ODD_NIGHTS':
      return nightNumber % 2 === 1;
    case 'EVEN_NIGHTS':
      return nightNumber % 2 === 0;
    case 'ON_TRIGGER':
      return false;
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}

/**
 * Maps an action type to its default resolution band when the role definition
 * omits an explicit band. `NONE` / `PASSIVE_INFO` yield null (no pending action).
 */
export function defaultBandForAction(
  actionType: ActionType,
): ResolutionBand | null {
  switch (actionType) {
    case 'SINGLE_TARGET':
      // Ambiguous without role flags — callers should prefer explicit bands.
      // Defaulting to ATTACK is unsafe; PROTECTION is safer as a no-op if mis-set
      // only when grantsProtection is also true. We use ATTACK only when lethal
      // is inferred elsewhere; here we return null to force explicit config for
      // SINGLE_TARGET unless schedule.resolutionBand is set.
      return null;
    case 'FACTION_VOTE':
      return 'ATTACK';
    case 'INSPECT_TARGET':
      return 'INVESTIGATION';
    case 'PASSIVE_INFO':
    case 'NONE':
      return null;
    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

/**
 * Resolves the effective resolution band for a wake schedule + role flags.
 */
export function resolveBand(
  role: RoleDefinition,
  schedule: WakeSchedule,
): ResolutionBand | null {
  if (schedule.resolutionBand) {
    return schedule.resolutionBand;
  }
  if (schedule.actionType === 'NONE' || schedule.actionType === 'PASSIVE_INFO') {
    return null;
  }
  if (schedule.actionType === 'INSPECT_TARGET') {
    return 'INVESTIGATION';
  }
  if (schedule.actionType === 'FACTION_VOTE' || role.isLethal) {
    return 'ATTACK';
  }
  if (role.grantsProtection) {
    return 'PROTECTION';
  }
  // Non-lethal single-target without an explicit band is treated as delayed
  // (curses / soft effects) so it never accidentally kills.
  if (schedule.actionType === 'SINGLE_TARGET') {
    return 'DELAYED';
  }
  return defaultBandForAction(schedule.actionType);
}

interface RoleGroup {
  role: RoleDefinition;
  actors: Player[];
}

/**
 * Collects alive non-master players who hold a given role id.
 */
function actorsForRole(
  roleId: RoleId,
  alivePlayers: Player[],
): Player[] {
  return alivePlayers.filter(
    (p) => !p.isMaster && p.isAlive && p.roleId === roleId,
  );
}

/**
 * Builds the ordered night queue for the current night.
 *
 * Rules:
 * 1. Skip roles with zero alive holders.
 * 2. Honour frequency against `nightNumber`.
 * 3. Sort by ascending `wakeSchedule.priority`.
 * 4. `FACTION_VOTE` roles that share the same faction + identical priority
 *    collapse into a single shared turn (all alive faction members act together).
 * 5. Roles with `actionType: 'NONE'` are omitted (they never wake).
 *
 * @param roles - Full room deck (including roles with count 0 leftovers).
 * @param alivePlayers - Players still alive; masters are ignored as actors.
 * @param nightNumber - 1-indexed night counter.
 * @returns Ordered `ScheduledTurn[]` ready for the FSM stepper.
 */
export function buildNightTurnQueue(
  roles: RoleDefinition[],
  alivePlayers: Player[],
  nightNumber: number,
): ScheduledTurn[] {
  const playable = roles.filter(
    (r) =>
      r.wakeSchedule.actionType !== 'NONE' &&
      shouldWakeOnNight(r.wakeSchedule.frequency, nightNumber),
  );

  const groups: RoleGroup[] = [];
  for (const role of playable) {
    const actors = actorsForRole(role.id, alivePlayers);
    if (actors.length === 0) continue;
    groups.push({ role, actors });
  }

  groups.sort(
    (a, b) => a.role.wakeSchedule.priority - b.role.wakeSchedule.priority,
  );

  const turns: ScheduledTurn[] = [];
  const consumedFactionKeys = new Set<string>();

  for (const group of groups) {
    const { role, actors } = group;
    const schedule = role.wakeSchedule;

    if (schedule.actionType === 'FACTION_VOTE') {
      const factionKey = `${role.faction}:${schedule.priority}`;
      if (consumedFactionKeys.has(factionKey)) {
        continue;
      }
      consumedFactionKeys.add(factionKey);

      // Merge all alive players of this faction who have a FACTION_VOTE role
      // at the same priority — typically the Ombre pack sharing one ballot.
      const factionActors = alivePlayers.filter((p) => {
        if (p.isMaster || !p.isAlive || !p.roleId) return false;
        const actorRole = roles.find((r) => r.id === p.roleId);
        if (!actorRole) return false;
        return (
          actorRole.faction === role.faction &&
          actorRole.wakeSchedule.actionType === 'FACTION_VOTE' &&
          actorRole.wakeSchedule.priority === schedule.priority &&
          shouldWakeOnNight(actorRole.wakeSchedule.frequency, nightNumber)
        );
      });

      turns.push(
        makeTurn({
          role,
          actors: factionActors,
          nightNumber,
          index: turns.length,
          faction: role.faction,
        }),
      );
      continue;
    }

    turns.push(
      makeTurn({
        role,
        actors,
        nightNumber,
        index: turns.length,
      }),
    );
  }

  return turns;
}

function makeTurn(args: {
  role: RoleDefinition;
  actors: Player[];
  nightNumber: number;
  index: number;
  faction?: Faction;
}): ScheduledTurn {
  const { role, actors, nightNumber, index, faction } = args;
  const schedule = role.wakeSchedule;
  return {
    turnId: `n${nightNumber}-t${index}-${role.id}`,
    roleId: role.id,
    roleName: role.name,
    actionType: schedule.actionType,
    priority: schedule.priority,
    resolutionBand: resolveBand(role, schedule),
    actorPlayerIds: actors.map((a) => a.id),
    durationMs: Math.max(1_000, schedule.timeMaskingDuration),
    wakePrompt:
      schedule.wakePrompt ??
      `Il tuo turno: ${role.name}. Agisci in silenzio.`,
    passiveInfoText: schedule.passiveInfoText,
    faction,
  };
}

/**
 * Injects an ON_TRIGGER role into an existing queue (Master / effect hook).
 * Inserts by priority while preserving relative order of equal priorities
 * (new turn is placed after existing equal-priority turns).
 */
export function injectTriggeredTurn(
  queue: ScheduledTurn[],
  role: RoleDefinition,
  actors: Player[],
  nightNumber: number,
): ScheduledTurn[] {
  if (actors.length === 0) return queue;
  const turn = makeTurn({
    role,
    actors,
    nightNumber,
    index: queue.length,
  });
  const next = [...queue, turn];
  next.sort((a, b) => a.priority - b.priority);
  // Re-stamp turnIds for stability in Master UI after injection.
  return next.map((t, i) => ({
    ...t,
    turnId: `n${nightNumber}-t${i}-${t.roleId}`,
  }));
}
