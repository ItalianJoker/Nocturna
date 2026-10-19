/**
 * @fileoverview Role deck sanitisation — custom ids allowed, enums clamped.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deckSeatTotal,
  sanitizeRoleDefinition,
  sanitizeRoleDeck,
} from './roleDeckValidation.js';
import { createDefaultRoleDeck } from './defaultRoles.js';

describe('sanitizeRoleDefinition', () => {
  it('accepts a custom role with valid enums', () => {
    const role = sanitizeRoleDefinition({
      id: 'custom_night_owl',
      name: 'Night Owl',
      faction: 'NEUTRAL',
      description: 'A custom solitary watcher.',
      colorHex: '#AABBCC',
      iconName: 'Moon',
      winCondition: 'LAST_SURVIVOR',
      count: 1,
      wakeSchedule: {
        frequency: 'ODD_NIGHTS',
        priority: 42,
        actionType: 'PASSIVE_INFO',
        timeMaskingDuration: 15_000,
        passiveInfoText: 'You hear wings.',
      },
    });
    assert.ok(role);
    assert.equal(role!.id, 'custom_night_owl');
    assert.equal(role!.faction, 'NEUTRAL');
    assert.equal(role!.wakeSchedule.frequency, 'ODD_NIGHTS');
    assert.equal(role!.wakeSchedule.passiveInfoText, 'You hear wings.');
  });

  it('rejects invalid ids', () => {
    assert.equal(sanitizeRoleDefinition({ id: '' }), null);
    assert.equal(sanitizeRoleDefinition({ id: '1bad' }), null);
    assert.equal(sanitizeRoleDefinition({ id: '../x' }), null);
    assert.equal(sanitizeRoleDefinition({ id: 'has space' }), null);
  });

  it('clamps count and falls back bad enums', () => {
    const role = sanitizeRoleDefinition({
      id: 'ok_role',
      name: 'Ok',
      faction: 'NOT_A_FACTION',
      winCondition: 'WIN_EVERYTHING',
      count: 99,
      colorHex: 'red',
      iconName: 'NotAnIcon',
      wakeSchedule: {
        frequency: 'SOMETIMES',
        actionType: 'EXPLODE',
        priority: -5,
        timeMaskingDuration: -1,
        resolutionBand: 'MAGIC',
      },
    });
    assert.ok(role);
    assert.equal(role!.count, 20);
    assert.equal(role!.faction, 'VILLAGE');
    assert.equal(role!.winCondition, 'ELIMINATE_ALL_IMPOSTORS');
    assert.equal(role!.colorHex, '#C4B5A0');
    assert.equal(role!.iconName, 'Users');
    assert.equal(role!.wakeSchedule.frequency, 'EVERY_NIGHT');
    assert.equal(role!.wakeSchedule.actionType, 'NONE');
    assert.equal(role!.wakeSchedule.priority, 0);
    assert.equal(role!.wakeSchedule.timeMaskingDuration, 0);
    assert.equal(role!.wakeSchedule.resolutionBand, undefined);
  });

  it('honours boolean flags and inspectReveals', () => {
    const role = sanitizeRoleDefinition({
      id: 'guard_like',
      name: 'Guard',
      grantsProtection: true,
      isLethal: 'yes',
      inspectReveals: 'ROLE',
      wakeSchedule: {
        frequency: 'EVERY_NIGHT',
        actionType: 'SINGLE_TARGET',
        priority: 10,
        timeMaskingDuration: 20_000,
        resolutionBand: 'PROTECTION',
      },
    });
    assert.ok(role);
    assert.equal(role!.grantsProtection, true);
    assert.equal(role!.isLethal, undefined);
    assert.equal(role!.inspectReveals, 'ROLE');
    assert.equal(role!.wakeSchedule.resolutionBand, 'PROTECTION');
  });
});

describe('sanitizeRoleDeck', () => {
  it('returns default deck for empty / non-array', () => {
    const a = sanitizeRoleDeck([]);
    const b = sanitizeRoleDeck(null);
    assert.equal(a.length, createDefaultRoleDeck().length);
    assert.equal(b.length, createDefaultRoleDeck().length);
  });

  it('keeps custom roles alongside catalog roles', () => {
    const deck = sanitizeRoleDeck([
      { id: 'cittadino', name: 'Citizen', count: 3, faction: 'VILLAGE' },
      {
        id: 'custom_fox',
        name: 'Fox',
        faction: 'SOLO',
        count: 1,
        winCondition: 'LAST_SURVIVOR',
        wakeSchedule: {
          frequency: 'EVERY_NIGHT',
          actionType: 'NONE',
          priority: 80,
          timeMaskingDuration: 0,
        },
      },
      { id: 'cittadino', name: 'Dup', count: 9 },
    ]);
    assert.equal(deck.length, 2);
    assert.equal(deck[0]!.id, 'cittadino');
    assert.equal(deck[0]!.count, 3);
    assert.equal(deck[1]!.id, 'custom_fox');
    assert.equal(deckSeatTotal(deck), 4);
  });
});
