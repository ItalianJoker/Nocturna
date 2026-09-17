/**
 * @fileoverview Unit tests for night scheduler + resolution engine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildNightTurnQueue, injectTriggeredTurn, resolveBand, shouldWakeOnNight } from './nightScheduler.js';
import { resolveNightActions, tallyFactionVotes } from './nightResolution.js';
import { createDefaultRoleDeck } from './defaultRoles.js';
import type { PendingAction, Player } from './types.js';

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

describe('buildNightTurnQueue', () => {
  it('orders by priority and skips NONE / dead / master', () => {
    const deck = createDefaultRoleDeck();
    const players = [
      makePlayer({ id: '1', displayName: 'A', roleId: 'guardia' }),
      makePlayer({ id: '2', displayName: 'B', roleId: 'oracolo' }),
      makePlayer({ id: '3', displayName: 'C', roleId: 'ombra' }),
      makePlayer({ id: '4', displayName: 'D', roleId: 'ombra' }),
      makePlayer({ id: '5', displayName: 'E', roleId: 'cittadino' }),
      makePlayer({
        id: 'm',
        displayName: 'Master',
        roleId: null,
        isMaster: true,
      }),
    ];
    const queue = buildNightTurnQueue(deck, players, 1);
    assert.equal(queue[0]?.roleId, 'guardia');
    assert.equal(queue[1]?.roleId, 'oracolo');
    assert.equal(queue[2]?.actionType, 'FACTION_VOTE');
    assert.deepEqual(queue[2]?.actorPlayerIds.sort(), ['3', '4']);
    assert.ok(!queue.some((t) => t.roleId === 'cittadino'));
  });

  it('respects FIRST_NIGHT_ONLY', () => {
    const deck = createDefaultRoleDeck();
    deck.push({
      id: 'augure',
      name: 'Augure',
      faction: 'VILLAGE',
      description: 'Solo prima notte',
      colorHex: '#aaa',
      iconName: 'Star',
      winCondition: 'ELIMINATE_ALL_IMPOSTORS',
      count: 1,
      wakeSchedule: {
        frequency: 'FIRST_NIGHT_ONLY',
        priority: 15,
        actionType: 'PASSIVE_INFO',
        timeMaskingDuration: 10_000,
        passiveInfoText: 'Visione.',
      },
    });
    const players = [
      makePlayer({ id: '1', displayName: 'A', roleId: 'augure' }),
      makePlayer({ id: '2', displayName: 'B', roleId: 'ombra' }),
    ];
    const n1 = buildNightTurnQueue(deck, players, 1);
    const n2 = buildNightTurnQueue(deck, players, 2);
    assert.ok(n1.some((t) => t.roleId === 'augure'));
    assert.ok(!n2.some((t) => t.roleId === 'augure'));
  });
});

describe('resolveNightActions', () => {
  it('protection cancels attack; investigation reads pre-death board', () => {
    const deck = createDefaultRoleDeck();
    const players = [
      makePlayer({ id: 'g', displayName: 'Guardia', roleId: 'guardia' }),
      makePlayer({ id: 'o', displayName: 'Oracolo', roleId: 'oracolo' }),
      makePlayer({ id: 'v', displayName: 'Vittima', roleId: 'cittadino' }),
      makePlayer({ id: 's', displayName: 'Ombra', roleId: 'ombra' }),
    ];
    const actions: PendingAction[] = [
      {
        id: 'a1',
        nightNumber: 1,
        actorPlayerId: 'g',
        actorRoleId: 'guardia',
        actionType: 'SINGLE_TARGET',
        resolutionBand: 'PROTECTION',
        priority: 10,
        targetPlayerId: 'v',
        submittedAt: 1,
        isNullAction: false,
      },
      {
        id: 'a2',
        nightNumber: 1,
        actorPlayerId: 'o',
        actorRoleId: 'oracolo',
        actionType: 'INSPECT_TARGET',
        resolutionBand: 'INVESTIGATION',
        priority: 20,
        targetPlayerId: 's',
        submittedAt: 2,
        isNullAction: false,
      },
      {
        id: 'a3',
        nightNumber: 1,
        actorPlayerId: 's',
        actorRoleId: 'ombra',
        actionType: 'FACTION_VOTE',
        resolutionBand: 'ATTACK',
        priority: 30,
        targetPlayerId: 'v',
        factionVotes: { s: 'v' },
        submittedAt: 3,
        isNullAction: false,
      },
    ];
    const result = resolveNightActions(actions, players, deck);
    assert.deepEqual(result.eliminatedPlayerIds, []);
    assert.deepEqual(result.savedPlayerIds, ['v']);
    assert.equal(result.investigationResults[0]?.revealed, 'Ombre');
    assert.equal(result.players.find((p) => p.id === 'v')?.isAlive, true);
    assert.equal(result.players.find((p) => p.id === 'v')?.isProtected, false);
  });

  it('kills unprotected targets', () => {
    const players = [
      makePlayer({ id: 'v', displayName: 'Vittima', roleId: 'cittadino' }),
      makePlayer({ id: 's', displayName: 'Ombra', roleId: 'ombra' }),
    ];
    const actions: PendingAction[] = [
      {
        id: 'a1',
        nightNumber: 1,
        actorPlayerId: 's',
        actorRoleId: 'ombra',
        actionType: 'SINGLE_TARGET',
        resolutionBand: 'ATTACK',
        priority: 30,
        targetPlayerId: 'v',
        submittedAt: 1,
        isNullAction: false,
      },
    ];
    const result = resolveNightActions(actions, players);
    assert.deepEqual(result.eliminatedPlayerIds, ['v']);
    assert.equal(result.players.find((p) => p.id === 'v')?.isAlive, false);
  });
});

describe('tallyFactionVotes', () => {
  it('picks majority target', () => {
    assert.equal(
      tallyFactionVotes({ a: 'x', b: 'x', c: 'y' }),
      'x',
    );
  });

  it('returns null on empty; ties keep first-seen target (stable)', () => {
    assert.equal(tallyFactionVotes({}), null);
    assert.equal(tallyFactionVotes({ a: 'x', b: 'y' }), 'x');
  });
});

describe('shouldWakeOnNight / resolveBand / injectTriggeredTurn', () => {
  it('honours ODD / EVEN / ON_TRIGGER frequencies', () => {
    assert.equal(shouldWakeOnNight('ODD_NIGHTS', 1), true);
    assert.equal(shouldWakeOnNight('ODD_NIGHTS', 2), false);
    assert.equal(shouldWakeOnNight('EVEN_NIGHTS', 2), true);
    assert.equal(shouldWakeOnNight('EVEN_NIGHTS', 1), false);
    assert.equal(shouldWakeOnNight('ON_TRIGGER', 1), false);
    assert.equal(shouldWakeOnNight('EVERY_NIGHT', 3), true);
  });

  it('resolveBand prefers explicit band then role flags', () => {
    const deck = createDefaultRoleDeck();
    const guardia = deck.find((r) => r.id === 'guardia')!;
    const ombra = deck.find((r) => r.id === 'ombra')!;
    const oracolo = deck.find((r) => r.id === 'oracolo')!;
    assert.equal(resolveBand(guardia, guardia.wakeSchedule), 'PROTECTION');
    assert.equal(resolveBand(ombra, ombra.wakeSchedule), 'ATTACK');
    assert.equal(resolveBand(oracolo, oracolo.wakeSchedule), 'INVESTIGATION');
  });

  it('injectTriggeredTurn inserts ON_TRIGGER by priority', () => {
    const deck = createDefaultRoleDeck();
    const players = [
      makePlayer({ id: '1', displayName: 'A', roleId: 'guardia' }),
      makePlayer({ id: '2', displayName: 'B', roleId: 'ombra' }),
      makePlayer({ id: '3', displayName: 'T', roleId: 'triggered' }),
    ];
    const triggerRole = {
      id: 'triggered',
      name: 'Triggered',
      faction: 'NEUTRAL' as const,
      description: 'Injected',
      colorHex: '#fff',
      iconName: 'Zap',
      winCondition: 'CUSTOM_SURVIVE' as const,
      count: 1,
      wakeSchedule: {
        frequency: 'ON_TRIGGER' as const,
        priority: 5,
        actionType: 'PASSIVE_INFO' as const,
        timeMaskingDuration: 5_000,
        passiveInfoText: 'Ping',
      },
    };
    const base = buildNightTurnQueue(deck, players, 1);
    assert.ok(!base.some((t) => t.roleId === 'triggered'));
    const next = injectTriggeredTurn(
      base,
      triggerRole,
      [players[2]!],
      1,
    );
    assert.ok(next.some((t) => t.roleId === 'triggered'));
    assert.ok(next[0]!.priority <= next[1]!.priority);
  });
});

describe('resolveNightActions DELAYED band', () => {
  it('DELAYED does not kill the target', () => {
    const players = [
      makePlayer({ id: 'v', displayName: 'V', roleId: 'cittadino' }),
      makePlayer({ id: 'c', displayName: 'Curse', roleId: 'cittadino' }),
    ];
    const actions: PendingAction[] = [
      {
        id: 'a1',
        nightNumber: 1,
        actorPlayerId: 'c',
        actorRoleId: 'cittadino',
        actionType: 'SINGLE_TARGET',
        resolutionBand: 'DELAYED',
        priority: 50,
        targetPlayerId: 'v',
        submittedAt: 1,
        isNullAction: false,
      },
    ];
    const result = resolveNightActions(actions, players);
    assert.deepEqual(result.eliminatedPlayerIds, []);
    assert.equal(result.players.find((p) => p.id === 'v')?.isAlive, true);
  });
});
