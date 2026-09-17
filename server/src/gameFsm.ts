/**
 * @fileoverview Server-authoritative finite state machine for Nocturna.
 *
 * All phase transitions, timers, night resolution, tribunal tallies, and win
 * checks live here. Clients render `phaseEndsAt` countdowns but never decide
 * outcomes. AUTOMATED mode advances on masked timers; ASSISTED mode waits for
 * Master commands (with optional timers as guidance).
 */

import {
  buildNightTurnQueue,
  evaluateWinConditions,
  resolveNightActions,
  tallyFactionVotes,
  type GameState,
  type PendingAction,
  type PlayerId,
  type ScheduledTurn,
} from '@nocturna/shared';
import {
  clearRoomTimer,
  dealRoles,
  getRoom,
  resetForRematch,
  setRoomTimer,
} from './roomManager.js';

/** Pattern broadcast on universal haptic pulses (ms on/off). */
export const HAPTIC_PATTERN = [70, 50, 70];

export type BroadcastFn = (roomId: string) => void;
export type HapticFn = (roomId: string, seq: number, pattern: number[]) => void;

let broadcastAll: BroadcastFn = () => undefined;
let emitHaptic: HapticFn = () => undefined;

/**
 * Wires IO side-effects without importing the Socket.io instance into this
 * module (keeps the FSM unit-testable).
 */
export function configureFsmIO(args: {
  broadcast: BroadcastFn;
  haptic: HapticFn;
}): void {
  broadcastAll = args.broadcast;
  emitHaptic = args.haptic;
}

function aliveNonMasters(room: GameState) {
  return [...room.players.values()].filter((p) => p.isAlive && !p.isMaster);
}

function bumpHaptic(room: GameState): void {
  if (room.settings.hapticPolicy !== 'UNIVERSAL_HEARTBEAT') return;
  room.hapticPulseSeq += 1;
  emitHaptic(room.roomId, room.hapticPulseSeq, HAPTIC_PATTERN);
}

/**
 * Host kicks off role distribution after lobby configuration.
 */
export function startGame(room: GameState): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'LOBBY') return { ok: false as const, error: 'La partita non è in lobby.' };
  if (room.settings.moderatorMode === 'ASSISTED') {
    const masters = [...room.players.values()].filter((p) => p.isMaster);
    if (masters.length !== 1) {
      return { ok: false as const, error: 'In modalità ASSISTED serve esattamente un Master.' };
    }
  } else {
    // AUTOMATED: nobody is Master.
    for (const p of room.players.values()) p.isMaster = false;
  }
  const deal = dealRoles(room);
  if ('error' in deal) return deal;
  room.phase = 'ROLE_REVEAL';
  room.phaseEndsAt = null;
  broadcastAll(room.roomId);
  return { ok: true };
}

/**
 * Transitions ROLE_REVEAL → first NIGHT.
 */
export function beginFirstNight(
  room: GameState,
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'ROLE_REVEAL') {
    return { ok: false as const, error: 'I ruoli non sono ancora stati assegnati.' };
  }
  room.nightNumber = 1;
  room.dayNumber = 0;
  enterNight(room);
  return { ok: true };
}

function enterNight(room: GameState): void {
  room.phase = 'NIGHT';
  room.pendingActions = [];
  room.pendingInvestigations.clear();
  room.dawnVictims = [];
  room.dawnSaved = [];
  room.tribunalVotes.clear();
  room.runoffCandidates = null;
  room.isPaused = false;

  const queue = buildNightTurnQueue(
    room.roleDeck,
    [...room.players.values()],
    room.nightNumber,
  );
  room.nightQueue = queue;
  room.currentTurnIndex = 0;

  if (queue.length === 0) {
    // No wakes tonight — resolve empty and go to dawn.
    finishNight(room);
    return;
  }

  startCurrentNightTurn(room);
}

function startCurrentNightTurn(room: GameState): void {
  const turn = room.nightQueue[room.currentTurnIndex];
  if (!turn) {
    finishNight(room);
    return;
  }

  // Ensure a faction-vote stub exists so live tallies can accumulate.
  if (turn.actionType === 'FACTION_VOTE') {
    const existing = room.pendingActions.find(
      (a) =>
        a.nightNumber === room.nightNumber &&
        a.actionType === 'FACTION_VOTE' &&
        a.actorRoleId === turn.roleId,
    );
    if (!existing) {
      room.pendingActions.push({
        id: `pending-${turn.turnId}`,
        nightNumber: room.nightNumber,
        actorPlayerId: turn.actorPlayerIds[0] ?? 'faction',
        actorRoleId: turn.roleId,
        actionType: 'FACTION_VOTE',
        resolutionBand: turn.resolutionBand ?? 'ATTACK',
        priority: turn.priority,
        targetPlayerId: null,
        factionVotes: {},
        submittedAt: Date.now(),
        isNullAction: true, // becomes false once at least one vote lands
      });
    }
  }

  bumpHaptic(room);

  const duration =
    turn.durationMs || room.settings.defaultNightTurnDurationMs;

  if (room.settings.moderatorMode === 'AUTOMATED') {
    room.phaseEndsAt = Date.now() + duration;
    setRoomTimer(room.roomId, duration, () => {
      const current = getRoom(room.roomId);
      if (!current || current.phase !== 'NIGHT' || current.isPaused) return;
      advanceNightTurn(current, { reason: 'timer' });
    });
  } else {
    const mult = Math.max(1, room.settings.assistedTimerMultiplier || 2);
    room.phaseEndsAt = Date.now() + duration * mult;
    setRoomTimer(room.roomId, duration * mult, () => {
      const current = getRoom(room.roomId);
      if (!current || current.phase !== 'NIGHT' || current.isPaused) return;
      advanceNightTurn(current, { reason: 'timer' });
    });
  }

  broadcastAll(room.roomId);
}

/**
 * Records a null action for actors who have not submitted when a turn ends.
 */
function fillNullActions(room: GameState, turn: ScheduledTurn): void {
  if (turn.actionType === 'NONE') return;
  if (turn.actionType === 'FACTION_VOTE') {
    const stub = room.pendingActions.find(
      (a) =>
        a.nightNumber === room.nightNumber &&
        a.actionType === 'FACTION_VOTE' &&
        a.actorRoleId === turn.roleId,
    );
    if (stub && Object.keys(stub.factionVotes ?? {}).length > 0) {
      stub.isNullAction = false;
      stub.targetPlayerId = tallyFactionVotes(stub.factionVotes);
    }
    return;
  }
  if (turn.actionType === 'PASSIVE_INFO') {
    for (const actorId of turn.actorPlayerIds) {
      const already = room.pendingActions.some(
        (a) =>
          a.nightNumber === room.nightNumber &&
          a.actorPlayerId === actorId &&
          a.actorRoleId === turn.roleId,
      );
      if (already) continue;
      room.pendingActions.push({
        id: `null-${turn.turnId}-${actorId}`,
        nightNumber: room.nightNumber,
        actorPlayerId: actorId,
        actorRoleId: turn.roleId,
        actionType: 'PASSIVE_INFO',
        resolutionBand: turn.resolutionBand ?? 'DELAYED',
        priority: turn.priority,
        targetPlayerId: null,
        submittedAt: Date.now(),
        isNullAction: true,
      });
    }
    return;
  }

  for (const actorId of turn.actorPlayerIds) {
    const already = room.pendingActions.some(
      (a) =>
        a.nightNumber === room.nightNumber &&
        a.actorPlayerId === actorId &&
        !a.isNullAction,
    );
    if (already) continue;
    room.pendingActions.push({
      id: `null-${turn.turnId}-${actorId}`,
      nightNumber: room.nightNumber,
      actorPlayerId: actorId,
      actorRoleId: turn.roleId,
      actionType: turn.actionType,
      resolutionBand: turn.resolutionBand ?? 'DELAYED',
      priority: turn.priority,
      targetPlayerId: null,
      submittedAt: Date.now(),
      isNullAction: true,
    });
  }
}

/**
 * Advances to the next night micro-turn, or finishes the night.
 * In AUTOMATED mode we always wait for the masking timer — callers that
 * receive an early player submit must NOT call this until the timer fires
 * (except Master force-advance).
 */
export function advanceNightTurn(
  room: GameState,
  _meta: { reason: 'timer' | 'master' | 'all_submitted' },
): void {
  if (room.phase !== 'NIGHT') return;
  const turn = room.nightQueue[room.currentTurnIndex];
  if (turn) fillNullActions(room, turn);

  room.currentTurnIndex += 1;
  if (room.currentTurnIndex >= room.nightQueue.length) {
    finishNight(room);
    return;
  }
  startCurrentNightTurn(room);
}

/**
 * Player action submission during a night micro-turn.
 * Does not end the turn early in AUTOMATED mode (timing-attack prevention).
 */
export function submitNightAction(
  room: GameState,
  playerId: PlayerId,
  payload: {
    turnId: string;
    targetPlayerId?: PlayerId | null;
    confirm?: boolean;
  },
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'NIGHT') return { ok: false as const, error: 'Non è notte.' };
  const turn = room.nightQueue[room.currentTurnIndex];
  if (!turn || turn.turnId !== payload.turnId) {
    return { ok: false as const, error: 'Turno non valido.' };
  }
  if (!turn.actorPlayerIds.includes(playerId)) {
    return { ok: false as const, error: 'Non sei sveglio in questo turno.' };
  }
  const player = room.players.get(playerId);
  if (!player?.isAlive) return { ok: false as const, error: 'Sei eliminato.' };

  if (turn.actionType === 'FACTION_VOTE') {
    const target = payload.targetPlayerId;
    if (!target || !room.players.get(target)?.isAlive) {
      return { ok: false as const, error: 'Bersaglio non valido.' };
    }
    let stub = room.pendingActions.find(
      (a) =>
        a.nightNumber === room.nightNumber &&
        a.actionType === 'FACTION_VOTE' &&
        a.actorRoleId === turn.roleId,
    );
    if (!stub) {
      stub = {
        id: `pending-${turn.turnId}`,
        nightNumber: room.nightNumber,
        actorPlayerId: playerId,
        actorRoleId: turn.roleId,
        actionType: 'FACTION_VOTE',
        resolutionBand: turn.resolutionBand ?? 'ATTACK',
        priority: turn.priority,
        targetPlayerId: null,
        factionVotes: {},
        submittedAt: Date.now(),
        isNullAction: false,
      };
      room.pendingActions.push(stub);
    }
    stub.factionVotes = { ...(stub.factionVotes ?? {}), [playerId]: target };
    stub.isNullAction = false;
    stub.targetPlayerId = tallyFactionVotes(stub.factionVotes);
    stub.submittedAt = Date.now();
    broadcastAll(room.roomId);
    maybeEarlyAdvanceIfAssistedComplete(room, turn);
    return { ok: true };
  }

  if (turn.actionType === 'PASSIVE_INFO') {
    room.pendingActions = room.pendingActions.filter(
      (a) =>
        !(
          a.nightNumber === room.nightNumber &&
          a.actorPlayerId === playerId &&
          a.actorRoleId === turn.roleId
        ),
    );
    room.pendingActions.push({
      id: `act-${turn.turnId}-${playerId}`,
      nightNumber: room.nightNumber,
      actorPlayerId: playerId,
      actorRoleId: turn.roleId,
      actionType: 'PASSIVE_INFO',
      resolutionBand: turn.resolutionBand ?? 'DELAYED',
      priority: turn.priority,
      targetPlayerId: null,
      submittedAt: Date.now(),
      isNullAction: false,
    });
    broadcastAll(room.roomId);
    maybeEarlyAdvanceIfAssistedComplete(room, turn);
    return { ok: true };
  }

  const targetId = payload.targetPlayerId ?? null;
  if (
    (turn.actionType === 'SINGLE_TARGET' ||
      turn.actionType === 'INSPECT_TARGET') &&
    (!targetId || !room.players.get(targetId)?.isAlive)
  ) {
    return { ok: false as const, error: 'Bersaglio non valido.' };
  }

  room.pendingActions = room.pendingActions.filter(
    (a) =>
      !(
        a.nightNumber === room.nightNumber &&
        a.actorPlayerId === playerId &&
        a.actorRoleId === turn.roleId
      ),
  );

  const action: PendingAction = {
    id: `act-${turn.turnId}-${playerId}`,
    nightNumber: room.nightNumber,
    actorPlayerId: playerId,
    actorRoleId: turn.roleId,
    actionType: turn.actionType,
    resolutionBand: turn.resolutionBand ?? 'DELAYED',
    priority: turn.priority,
    targetPlayerId: targetId,
    submittedAt: Date.now(),
    isNullAction: false,
  };
  room.pendingActions.push(action);
  broadcastAll(room.roomId);
  maybeEarlyAdvanceIfAssistedComplete(room, turn);
  return { ok: true };
}

/**
 * In ASSISTED mode, once every actor has submitted, the Master can still
 * force-advance; we do not auto-skip the masking window in AUTOMATED.
 * For ASSISTED we also avoid auto-advance — Master drives the stepper.
 * This helper only refreshes state.
 */
function maybeEarlyAdvanceIfAssistedComplete(
  _room: GameState,
  _turn: ScheduledTurn,
): void {
  // Intentionally no-op: timing-attack prevention + Master control.
}

function finishNight(room: GameState): void {
  clearRoomTimer(room.roomId);
  const result = resolveNightActions(
    room.pendingActions,
    [...room.players.values()],
    room.roleDeck,
  );

  // Apply mutated players back into the map.
  for (const p of result.players) {
    room.players.set(p.id, p);
  }
  room.dawnVictims = result.eliminatedPlayerIds;
  room.dawnSaved = result.savedPlayerIds;
  room.actionLog.push(...result.logs);
  room.pendingInvestigations.clear();
  for (const inv of result.investigationResults) {
    room.pendingInvestigations.set(inv.actorPlayerId, {
      targetPlayerId: inv.targetPlayerId,
      revealed: inv.revealed,
    });
  }

  room.phase = 'DAWN';
  room.dayNumber = room.nightNumber;
  const dawnMs = Math.max(1_000, room.settings.dawnDurationMs || 8_000);
  room.phaseEndsAt = Date.now() + dawnMs;
  room.nightQueue = [];
  room.currentTurnIndex = 0;

  const win = evaluateWinConditions(
    [...room.players.values()],
    room.roleDeck,
  );
  if (win.terminal) {
    endGame(room, win);
    return;
  }

  setRoomTimer(room.roomId, dawnMs, () => {
    const current = getRoom(room.roomId);
    if (!current || current.phase !== 'DAWN') return;
    enterDiscussion(current);
  });
  broadcastAll(room.roomId);
}

function endGame(
  room: GameState,
  win: ReturnType<typeof evaluateWinConditions>,
): void {
  clearRoomTimer(room.roomId);
  room.phase = 'ENDED';
  room.phaseEndsAt = null;
  room.winningFaction = win.winningFaction;
  room.winningPlayerIds = win.winningPlayerIds;
  broadcastAll(room.roomId);
}

export function enterDiscussion(room: GameState): void {
  room.phase = 'DISCUSSION';
  room.isPaused = false;
  const duration = room.settings.discussionDurationMs;
  room.phaseEndsAt = Date.now() + duration;

  if (room.settings.moderatorMode === 'AUTOMATED') {
    setRoomTimer(room.roomId, duration, () => {
      const current = getRoom(room.roomId);
      if (!current || current.phase !== 'DISCUSSION' || current.isPaused) return;
      enterTribunal(current);
    });
  } else {
    const mult = Math.max(1, room.settings.assistedTimerMultiplier || 2);
    setRoomTimer(room.roomId, duration * mult, () => {
      const current = getRoom(room.roomId);
      if (!current || current.phase !== 'DISCUSSION' || current.isPaused) return;
      enterTribunal(current);
    });
  }
  broadcastAll(room.roomId);
}

export function enterTribunal(room: GameState): void {
  clearRoomTimer(room.roomId);
  room.phase = 'TRIBUNAL';
  room.tribunalVotes.clear();
  const duration = room.settings.tribunalDurationMs;
  room.phaseEndsAt = Date.now() + duration;
  setRoomTimer(room.roomId, duration, () => {
    const current = getRoom(room.roomId);
    if (!current || current.phase !== 'TRIBUNAL') return;
    resolveTribunal(current);
  });
  broadcastAll(room.roomId);
}

export function castTribunalVote(
  room: GameState,
  voterId: PlayerId,
  target: PlayerId | 'ABSTAIN',
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== 'TRIBUNAL' && room.phase !== 'BALLOT') {
    return { ok: false as const, error: 'Il tribunale non è aperto.' };
  }
  const voter = room.players.get(voterId);
  if (!voter || !voter.isAlive || voter.isMaster) {
    return { ok: false as const, error: 'Non puoi votare.' };
  }
  if (target !== 'ABSTAIN') {
    const t = room.players.get(target);
    if (!t?.isAlive || t.isMaster) return { ok: false as const, error: 'Bersaglio non valido.' };
    if (
      room.runoffCandidates &&
      !room.runoffCandidates.includes(target)
    ) {
      return { ok: false as const, error: 'Bersaglio fuori dal ballottaggio.' };
    }
  }
  room.tribunalVotes.set(voterId, target);
  broadcastAll(room.roomId);

  // Early resolve when everyone alive has voted.
  const voters = aliveNonMasters(room);
  if (voters.every((p) => room.tribunalVotes.has(p.id))) {
    clearRoomTimer(room.roomId);
    resolveTribunal(room);
  }
  return { ok: true };
}

function resolveTribunal(room: GameState): void {
  const tallies = new Map<string, number>();
  for (const vote of room.tribunalVotes.values()) {
    tallies.set(vote, (tallies.get(vote) ?? 0) + 1);
  }
  tallies.delete('ABSTAIN');

  let bestCount = 0;
  let leaders: string[] = [];
  for (const [id, count] of tallies) {
    if (count > bestCount) {
      bestCount = count;
      leaders = [id];
    } else if (count === bestCount) {
      leaders.push(id);
    }
  }

  room.phase = 'BALLOT';
  const ballotMs = Math.max(1_000, room.settings.ballotRevealDurationMs || 5_000);
  room.phaseEndsAt = Date.now() + ballotMs;
  broadcastAll(room.roomId);

  const finish = () => {
    const current = getRoom(room.roomId);
    if (!current) return;

    if (leaders.length === 1 && bestCount > 0) {
      const eliminated = current.players.get(leaders[0]!);
      if (eliminated) eliminated.isAlive = false;
    } else if (leaders.length > 1 && bestCount > 0) {
      if (
        current.settings.tieBreakPolicy === 'RUNOFF' &&
        !current.runoffCandidates
      ) {
        current.runoffCandidates = leaders;
        current.tribunalVotes.clear();
        current.phase = 'TRIBUNAL';
        const duration = current.settings.tribunalDurationMs;
        current.phaseEndsAt = Date.now() + duration;
        setRoomTimer(current.roomId, duration, () => {
          const r = getRoom(current.roomId);
          if (!r || r.phase !== 'TRIBUNAL') return;
          resolveTribunal(r);
        });
        broadcastAll(current.roomId);
        return;
      }
      // NO_ELIMINATION or second tie — nobody burns.
    }

    current.runoffCandidates = null;
    const win = evaluateWinConditions(
      [...current.players.values()],
      current.roleDeck,
    );
    if (win.terminal) {
      endGame(current, win);
      return;
    }

    // Next night.
    current.nightNumber += 1;
    enterNight(current);
  };

  setRoomTimer(room.roomId, ballotMs, finish);
}

export function masterForceAdvance(
  room: GameState,
): { ok: true } | { ok: false; error: string } {
  if (room.settings.moderatorMode !== 'ASSISTED') {
    return { ok: false as const, error: 'Solo in modalità ASSISTED.' };
  }
  if (room.phase === 'NIGHT') {
    clearRoomTimer(room.roomId);
    advanceNightTurn(room, { reason: 'master' });
    return { ok: true };
  }
  if (room.phase === 'DISCUSSION') {
    enterTribunal(room);
    return { ok: true };
  }
  if (room.phase === 'DAWN') {
    clearRoomTimer(room.roomId);
    enterDiscussion(room);
    return { ok: true };
  }
  if (room.phase === 'TRIBUNAL') {
    clearRoomTimer(room.roomId);
    resolveTribunal(room);
    return { ok: true };
  }
  return { ok: false as const, error: 'Nessun avanzamento possibile in questa fase.' };
}

export function masterSetPaused(
  room: GameState,
  paused: boolean,
): { ok: true } | { ok: false; error: string } {
  if (room.settings.moderatorMode !== 'ASSISTED') {
    return { ok: false as const, error: 'Solo in modalità ASSISTED.' };
  }
  room.isPaused = paused;
  if (paused) {
    clearRoomTimer(room.roomId);
    room.phaseEndsAt = null;
  }
  broadcastAll(room.roomId);
  return { ok: true };
}

export function masterCancelAction(
  room: GameState,
  actionId: string,
): { ok: true } | { ok: false; error: string } {
  if (room.settings.moderatorMode !== 'ASSISTED') {
    return { ok: false as const, error: 'Solo in modalità ASSISTED.' };
  }
  const before = room.pendingActions.length;
  room.pendingActions = room.pendingActions.filter((a) => a.id !== actionId);
  if (room.pendingActions.length === before) {
    return { ok: false as const, error: 'Azione non trovata.' };
  }
  broadcastAll(room.roomId);
  return { ok: true };
}

export function masterSetPhase(
  room: GameState,
  phase: 'DISCUSSION' | 'TRIBUNAL' | 'NIGHT',
): { ok: true } | { ok: false; error: string } {
  if (room.settings.moderatorMode !== 'ASSISTED') {
    return { ok: false as const, error: 'Solo in modalità ASSISTED.' };
  }
  if (phase === 'DISCUSSION') {
    enterDiscussion(room);
    return { ok: true };
  }
  if (phase === 'TRIBUNAL') {
    enterTribunal(room);
    return { ok: true };
  }
  if (phase === 'NIGHT') {
    if (room.phase === 'ROLE_REVEAL') {
      return beginFirstNight(room);
    }
    room.nightNumber += 1;
    enterNight(room);
    return { ok: true };
  }
  return { ok: false as const, error: 'Fase non supportata.' };
}

export function rematch(room: GameState): void {
  resetForRematch(room);
  broadcastAll(room.roomId);
}
