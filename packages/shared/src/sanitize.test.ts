/**
 * @fileoverview Regression tests for anti-leak sanitisation views.
 *
 * Invariants: non-master never sees roles of others; SECRET tribunal hides
 * peer votes/tallies; Master God-View only via viewForPlayer in ASSISTED.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toSanitizedGameState,
  toMasterGameState,
  viewForPlayer,
} from './sanitize.js';
import { createDefaultRoleDeck } from './defaultRoles.js';
import { DEFAULT_ROOM_SETTINGS, type GameState, type Player } from './types.js';

function makePlayer(
  partial: Partial<Player> & Pick<Player, 'id' | 'displayName'>,
): Player {
  return {
    sessionToken: `tok-${partial.id}`,
    socketId: null,
    isHost: false,
    isMaster: false,
    isConnected: true,
    isAlive: true,
    roleId: null,
    isProtected: false,
    markedForDeath: false,
    joinedAt: Date.now(),
    ...partial,
  };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  const host = makePlayer({
    id: 'host',
    displayName: 'Host',
    isHost: true,
    roleId: 'cittadino',
  });
  const shadow = makePlayer({
    id: 'shadow',
    displayName: 'Ombra',
    roleId: 'ombra',
  });
  const players = new Map<string, Player>([
    [host.id, host],
    [shadow.id, shadow],
  ]);
  return {
    roomId: '123456',
    createdAt: 1,
    hostPlayerId: host.id,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    phase: 'DISCUSSION',
    phaseEndsAt: null,
    nightNumber: 1,
    dayNumber: 1,
    players,
    roleDeck: createDefaultRoleDeck(),
    nightQueue: [],
    currentTurnIndex: 0,
    pendingActions: [],
    pendingInvestigations: new Map(),
    tribunalVotes: new Map(),
    runoffCandidates: null,
    dawnVictims: [],
    dawnSaved: [],
    isPaused: false,
    hapticPulseSeq: 0,
    winningFaction: null,
    winningPlayerIds: [],
    actionLog: [],
    timerToken: null,
    ...overrides,
  };
}

describe('toSanitizedGameState', () => {
  it('never leaks other players\' roleIds on the public roster', () => {
    const state = baseState();
    const view = toSanitizedGameState(state, 'host');
    for (const p of view.players) {
      assert.equal('roleId' in p, false);
      assert.equal('roleName' in p, false);
    }
    assert.equal(view.you.roleId, 'cittadino');
    assert.ok(!('masterRoster' in view));
  });

  it('includes hostDeck only for Host in LOBBY', () => {
    const lobby = baseState({ phase: 'LOBBY' });
    const hostView = toSanitizedGameState(lobby, 'host');
    assert.ok(hostView.hostDeck);
    assert.ok(hostView.hostDeck!.length > 0);

    const guest = makePlayer({ id: 'guest', displayName: 'G', roleId: null });
    lobby.players.set(guest.id, guest);
    const guestView = toSanitizedGameState(lobby, 'guest');
    assert.equal(guestView.hostDeck, undefined);

    const night = baseState({ phase: 'NIGHT' });
    const nightHost = toSanitizedGameState(night, 'host');
    assert.equal(nightHost.hostDeck, undefined);
  });

  it('SECRET tribunal hides peer votes and tallies until BALLOT', () => {
    const state = baseState({
      phase: 'TRIBUNAL',
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        voteVisibility: 'SECRET',
      },
      tribunalVotes: new Map([
        ['host', 'shadow'],
        ['shadow', 'host'],
      ]),
    });
    const view = toSanitizedGameState(state, 'host');
    assert.ok(view.tribunal);
    assert.equal(view.tribunal!.myVote, 'shadow');
    assert.equal(view.tribunal!.votes.host, 'shadow');
    assert.equal(view.tribunal!.votes.shadow, null);
    assert.deepEqual(view.tribunal!.tallies, {});

    const ballot = baseState({
      phase: 'BALLOT',
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        voteVisibility: 'SECRET',
      },
      tribunalVotes: new Map([
        ['host', 'shadow'],
        ['shadow', 'host'],
      ]),
    });
    const ballotView = toSanitizedGameState(ballot, 'host');
    assert.equal(ballotView.tribunal!.tallies.shadow, 1);
    assert.equal(ballotView.tribunal!.tallies.host, 1);
  });

  it('throws for unknown viewer', () => {
    assert.throws(() => toSanitizedGameState(baseState(), 'missing'));
  });
});

describe('toMasterGameState / viewForPlayer', () => {
  it('exposes roster roles only on MasterGameState', () => {
    const master = makePlayer({
      id: 'master',
      displayName: 'M',
      isMaster: true,
      roleId: null,
    });
    const state = baseState({
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        moderatorMode: 'ASSISTED',
      },
    });
    state.players.set(master.id, master);
    const god = toMasterGameState(state);
    assert.ok(god.masterRoster.some((p) => p.roleId === 'ombra'));
    assert.ok(!('you' in god));
  });

  it('viewForPlayer returns Master view only in ASSISTED for isMaster', () => {
    const master = makePlayer({
      id: 'master',
      displayName: 'M',
      isMaster: true,
    });
    const assisted = baseState({
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        moderatorMode: 'ASSISTED',
      },
    });
    assisted.players.set(master.id, master);
    const assistedView = viewForPlayer(assisted, 'master');
    assert.ok('masterRoster' in assistedView);

    const auto = baseState({
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        moderatorMode: 'AUTOMATED',
      },
    });
    auto.players.set(master.id, master);
    const autoView = viewForPlayer(auto, 'master');
    assert.ok(!('masterRoster' in autoView));
    assert.ok('you' in autoView);
  });
});
