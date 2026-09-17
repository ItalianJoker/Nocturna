/**
 * @fileoverview Unit tests for win-condition evaluation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countAliveByFaction,
  evaluateWinConditions,
} from './winConditions.js';
import { createDefaultRoleDeck } from './defaultRoles.js';
import type { Player, RoleDefinition } from './types.js';

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

const deck = createDefaultRoleDeck();

describe('countAliveByFaction', () => {
  it('ignores masters and dead players', () => {
    const players = [
      makePlayer({ id: '1', displayName: 'V', roleId: 'cittadino' }),
      makePlayer({ id: '2', displayName: 'O', roleId: 'ombra' }),
      makePlayer({
        id: '3',
        displayName: 'Dead',
        roleId: 'cittadino',
        isAlive: false,
      }),
      makePlayer({
        id: 'm',
        displayName: 'Master',
        isMaster: true,
        roleId: null,
      }),
    ];
    const counts = countAliveByFaction(players, deck);
    assert.equal(counts.VILLAGE, 1);
    assert.equal(counts.IMPOSTORS, 1);
  });
});

describe('evaluateWinConditions', () => {
  it('village wins when no impostors remain', () => {
    const players = [
      makePlayer({ id: '1', displayName: 'V', roleId: 'cittadino' }),
      makePlayer({ id: '2', displayName: 'G', roleId: 'guardia' }),
    ];
    const result = evaluateWinConditions(players, deck);
    assert.equal(result.terminal, true);
    assert.equal(result.winningFaction, 'VILLAGE');
    assert.ok(result.winningPlayerIds.includes('1'));
  });

  it('impostors win when count >= village', () => {
    const players = [
      makePlayer({ id: '1', displayName: 'V', roleId: 'cittadino' }),
      makePlayer({ id: '2', displayName: 'O1', roleId: 'ombra' }),
      makePlayer({ id: '3', displayName: 'O2', roleId: 'ombra' }),
    ];
    const result = evaluateWinConditions(players, deck);
    assert.equal(result.terminal, true);
    assert.equal(result.winningFaction, 'IMPOSTORS');
  });

  it('draw when zero alive non-masters', () => {
    const players = [
      makePlayer({
        id: '1',
        displayName: 'Dead',
        roleId: 'cittadino',
        isAlive: false,
      }),
      makePlayer({ id: 'm', displayName: 'Master', isMaster: true }),
    ];
    const result = evaluateWinConditions(players, deck);
    assert.equal(result.terminal, true);
    assert.equal(result.winningFaction, 'NONE');
  });

  it('sole LAST_SURVIVOR with no impostors yields VILLAGE terminal (priority order)', () => {
    // Documented priority: IMPOSTORS===0 → VILLAGE before LAST_SURVIVOR branch.
    // LAST_SURVIVOR remains exported for future decks; see watchlist.
    const soloRole: RoleDefinition = {
      id: 'errante',
      name: 'Errante',
      faction: 'SOLO',
      description: 'Solo',
      colorHex: '#ccc',
      iconName: 'Moon',
      winCondition: 'LAST_SURVIVOR',
      count: 1,
      wakeSchedule: {
        frequency: 'ON_TRIGGER',
        priority: 99,
        actionType: 'NONE',
        timeMaskingDuration: 1_000,
      },
    };
    const roles = [...deck, soloRole];
    const players = [
      makePlayer({ id: 'solo', displayName: 'Solo', roleId: 'errante' }),
    ];
    const result = evaluateWinConditions(players, roles);
    assert.equal(result.terminal, true);
    assert.equal(result.winningFaction, 'VILLAGE');
  });

  it('non-terminal while both factions still balanced', () => {
    const players = [
      makePlayer({ id: '1', displayName: 'V1', roleId: 'cittadino' }),
      makePlayer({ id: '2', displayName: 'V2', roleId: 'guardia' }),
      makePlayer({ id: '3', displayName: 'O', roleId: 'ombra' }),
    ];
    const result = evaluateWinConditions(players, deck);
    assert.equal(result.terminal, false);
    assert.equal(result.winningFaction, null);
  });
});
