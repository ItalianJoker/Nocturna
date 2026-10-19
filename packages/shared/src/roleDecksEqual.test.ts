/**
 * @fileoverview roleDecksEqual — guard against Host draft sync loops.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultPartyDeck,
  roleDecksEqual,
} from './defaultRoles.js';

describe('roleDecksEqual', () => {
  it('treats identical clones as equal', () => {
    const a = createDefaultPartyDeck();
    const b = a.map((r) => ({
      ...r,
      wakeSchedule: { ...r.wakeSchedule },
    }));
    assert.equal(roleDecksEqual(a, b), true);
  });

  it('detects count changes', () => {
    const a = createDefaultPartyDeck();
    const b = a.map((r, i) =>
      i === 0 ? { ...r, count: r.count + 1, wakeSchedule: { ...r.wakeSchedule } } : { ...r, wakeSchedule: { ...r.wakeSchedule } },
    );
    assert.equal(roleDecksEqual(a, b), false);
  });

  it('handles null / empty', () => {
    assert.equal(roleDecksEqual(null, null), true);
    assert.equal(roleDecksEqual([], []), true);
    assert.equal(roleDecksEqual(null, []), false);
  });
});
