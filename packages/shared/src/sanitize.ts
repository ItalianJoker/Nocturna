/**
 * @fileoverview Server-side state sanitisation for Nocturna.
 *
 * Critical anti-cheat rule: never send `GameState` to a browser and filter
 * there. Every socket receives either `SanitizedGameState` or, exclusively
 * for `isMaster` in ASSISTED mode, `MasterGameState`.
 */

import type {
  GameState,
  MasterGameState,
  Player,
  PlayerId,
  PrivatePlayerView,
  RoleDefinition,
  SanitizedGameState,
  SanitizedNightView,
} from './types.js';

function roleMap(roles: RoleDefinition[]): Map<string, RoleDefinition> {
  return new Map(roles.map((r) => [r.id, r]));
}

function buildPrivateView(
  player: Player,
  state: GameState,
): PrivatePlayerView {
  const roles = roleMap(state.roleDeck);
  const role = player.roleId ? roles.get(player.roleId) : undefined;
  const inspect = state.pendingInvestigations.get(player.id);
  let lastInspectResult: PrivatePlayerView['lastInspectResult'] = null;
  if (inspect) {
    const target = state.players.get(inspect.targetPlayerId);
    lastInspectResult = {
      targetName: target?.displayName ?? 'Sconosciuto',
      revealed: inspect.revealed,
    };
  }
  return {
    playerId: player.id,
    roleId: role?.id ?? null,
    roleName: role?.name ?? null,
    roleDescription: role?.description ?? null,
    faction: role?.faction ?? null,
    colorHex: role?.colorHex ?? null,
    iconName: role?.iconName ?? null,
    lastInspectResult,
  };
}

function publicPlayers(state: GameState): SanitizedGameState['players'] {
  return [...state.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isHost: p.isHost,
      isMaster: p.isMaster,
      isConnected: p.isConnected,
      isAlive: p.isAlive,
    }));
}

function settingsPublic(
  state: GameState,
): SanitizedGameState['settings'] {
  // Full RoomSettings copy — no secrets; Host timers must be visible/editable.
  return { ...state.settings };
}

function dawnBlock(
  state: GameState,
): SanitizedGameState['dawnAnnouncement'] {
  if (state.phase !== 'DAWN' && state.phase !== 'DISCUSSION') {
    // Keep announcement through early discussion; clear later phases.
    if (state.phase === 'NIGHT' || state.phase === 'LOBBY' || state.phase === 'ROLE_REVEAL') {
      return null;
    }
  }
  if (state.dawnVictims.length === 0 && state.dawnSaved.length === 0) {
    if (state.phase !== 'DAWN') return null;
  }
  if (state.phase !== 'DAWN' && state.phase !== 'DISCUSSION') {
    return null;
  }
  const nameOf = (id: PlayerId) =>
    state.players.get(id)?.displayName ?? 'Sconosciuto';
  return {
    victimNames: state.dawnVictims.map(nameOf),
    savedNames: state.dawnSaved.map(nameOf),
  };
}

function endingBlock(
  state: GameState,
): SanitizedGameState['ending'] {
  if (state.phase !== 'ENDED') return null;
  const roles = roleMap(state.roleDeck);
  const reveal = [...state.players.values()]
    .filter((p) => !p.isMaster)
    .map((p) => {
      const role = p.roleId ? roles.get(p.roleId) : undefined;
      return {
        playerId: p.id,
        displayName: p.displayName,
        roleName: role?.name ?? '?',
        faction: role?.faction ?? ('NEUTRAL' as const),
        survived: p.isAlive,
      };
    });
  return {
    winningFaction: state.winningFaction,
    winningPlayerIds: state.winningPlayerIds,
    reveal,
    summary:
      state.winningFaction === 'VILLAGE'
        ? 'Il Villaggio ha trionfato.'
        : state.winningFaction === 'IMPOSTORS'
          ? 'Le Ombre hanno preso il controllo.'
          : state.winningFaction === 'NONE'
            ? 'Pareggio.'
            : 'La notte è finita.',
  };
}

function tribunalBlock(
  state: GameState,
  viewerId: PlayerId,
): SanitizedGameState['tribunal'] {
  if (state.phase !== 'TRIBUNAL' && state.phase !== 'BALLOT') {
    return null;
  }
  const myVote = state.tribunalVotes.get(viewerId) ?? null;
  const tallies: Record<string, number> = {};
  const votes: Record<string, PlayerId | 'ABSTAIN' | null> = {};

  for (const p of state.players.values()) {
    if (p.isMaster || !p.isAlive) continue;
    const v = state.tribunalVotes.get(p.id) ?? null;
    if (state.settings.voteVisibility === 'PUBLIC') {
      votes[p.id] = v;
    } else {
      votes[p.id] = p.id === viewerId ? v : null;
    }
    if (v) {
      tallies[v] = (tallies[v] ?? 0) + 1;
    }
  }

  // In SECRET mode hide tallies until BALLOT reveal / ENDED — still show own.
  const visibleTallies =
    state.settings.voteVisibility === 'PUBLIC' || state.phase === 'BALLOT'
      ? (tallies as SanitizedGameState['tribunal'] extends null
          ? never
          : NonNullable<SanitizedGameState['tribunal']>['tallies'])
      : ({} as NonNullable<SanitizedGameState['tribunal']>['tallies']);

  return {
    votes,
    tallies: visibleTallies,
    myVote,
    runoffOf: state.runoffCandidates,
  };
}

function nightViewFor(
  state: GameState,
  viewer: Player,
): SanitizedNightView | null {
  if (state.phase !== 'NIGHT') return null;
  const turn = state.nightQueue[state.currentTurnIndex] ?? null;
  const isAwake = !!turn && turn.actorPlayerIds.includes(viewer.id);

  if (!turn || !isAwake) {
    return {
      nightNumber: state.nightNumber,
      isAwake: false,
      currentTurn: null,
    };
  }

  const eligibleTargets = [...state.players.values()]
    .filter((p) => p.isAlive && !p.isMaster && p.id !== viewer.id)
    .map((p) => ({ id: p.id, displayName: p.displayName }));

  // Self-target allowed for protection roles — add self back when actor's role grants protection.
  const viewerRole = viewer.roleId
    ? state.roleDeck.find((r) => r.id === viewer.roleId)
    : undefined;
  if (viewerRole?.grantsProtection && viewer.isAlive) {
    eligibleTargets.unshift({
      id: viewer.id,
      displayName: `${viewer.displayName} (tu)`,
    });
  }

  const hasSubmitted = state.pendingActions.some(
    (a) =>
      a.nightNumber === state.nightNumber &&
      a.actorPlayerId === viewer.id &&
      !a.isNullAction,
  );

  // Faction vote tallies: only for same-faction awake actors.
  const factionVoteTally: Record<string, number> = {};
  if (turn.actionType === 'FACTION_VOTE') {
    const factionAction = state.pendingActions.find(
      (a) =>
        a.nightNumber === state.nightNumber &&
        a.actionType === 'FACTION_VOTE' &&
        a.actorRoleId === turn.roleId,
    );
    const votes = factionAction?.factionVotes ?? {};
    // Also merge in-progress votes stored on any matching pending stub.
    for (const targetId of Object.values(votes)) {
      factionVoteTally[targetId] = (factionVoteTally[targetId] ?? 0) + 1;
    }
  }

  return {
    nightNumber: state.nightNumber,
    isAwake: true,
    currentTurn: {
      turnId: turn.turnId,
      roleName: turn.roleName,
      actionType: turn.actionType,
      wakePrompt: turn.wakePrompt,
      passiveInfoText: turn.passiveInfoText,
      eligibleTargets,
      factionVoteTally,
      turnEndsAt: state.phaseEndsAt,
      hasSubmitted,
    },
  };
}

/**
 * Builds the only legal payload for a non-master player socket.
 */
export function toSanitizedGameState(
  state: GameState,
  viewerId: PlayerId,
): SanitizedGameState {
  const viewer = state.players.get(viewerId);
  if (!viewer) {
    throw new Error(`Unknown viewer ${viewerId}`);
  }
  const payload: SanitizedGameState = {
    roomId: state.roomId,
    phase: state.phase,
    settings: settingsPublic(state),
    phaseEndsAt: state.phaseEndsAt,
    nightNumber: state.nightNumber,
    dayNumber: state.dayNumber,
    players: publicPlayers(state),
    you: buildPrivateView(viewer, state),
    night: nightViewFor(state, viewer),
    dawnAnnouncement: dawnBlock(state),
    tribunal: tribunalBlock(state, viewerId),
    ending: endingBlock(state),
    serverNow: Date.now(),
    hapticPulseSeq: state.hapticPulseSeq,
  };

  // Host needs the deck in lobby to drive RoleScheduleEditor without God-View.
  if (viewer.isHost && state.phase === 'LOBBY') {
    payload.hostDeck = state.roleDeck.map((r) => ({
      ...r,
      wakeSchedule: { ...r.wakeSchedule },
    }));
  }

  return payload;
}

/**
 * Builds the God-View payload for the designated Master.
 * Must never be emitted to a socket where `player.isMaster !== true`.
 */
export function toMasterGameState(state: GameState): MasterGameState {
  const roles = roleMap(state.roleDeck);
  const masterRoster = [...state.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => {
      const role = p.roleId ? roles.get(p.roleId) : undefined;
      return {
        id: p.id,
        displayName: p.displayName,
        isHost: p.isHost,
        isMaster: p.isMaster,
        isConnected: p.isConnected,
        isAlive: p.isAlive,
        roleId: p.roleId,
        roleName: role?.name ?? null,
        faction: role?.faction ?? null,
        isProtected: p.isProtected,
        markedForDeath: p.markedForDeath,
      };
    });

  // Pick any master as viewer for shared public blocks; fall back to host.
  const master =
    [...state.players.values()].find((p) => p.isMaster) ??
    state.players.get(state.hostPlayerId);
  if (!master) {
    throw new Error('No master/host available for MasterGameState');
  }

  const sanitized = toSanitizedGameState(state, master.id);
  const { you: _you, night: _night, ...rest } = sanitized;

  return {
    ...rest,
    masterRoster,
    nightQueue: state.nightQueue.map((t) => ({ ...t })),
    currentTurnIndex: state.currentTurnIndex,
    pendingActions: state.pendingActions.map((a) => ({
      ...a,
      factionVotes: a.factionVotes ? { ...a.factionVotes } : undefined,
    })),
    isPaused: state.isPaused,
    roleDeck: state.roleDeck.map((r) => ({
      ...r,
      wakeSchedule: { ...r.wakeSchedule },
    })),
  };
}

/**
 * Chooses the correct outbound view for a socket's bound player.
 */
export function viewForPlayer(
  state: GameState,
  playerId: PlayerId,
): SanitizedGameState | MasterGameState {
  const player = state.players.get(playerId);
  if (
    player?.isMaster &&
    state.settings.moderatorMode === 'ASSISTED'
  ) {
    return toMasterGameState(state);
  }
  return toSanitizedGameState(state, playerId);
}
