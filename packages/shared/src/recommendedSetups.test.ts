/**
 * @fileoverview Recommended setup sanity checks.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDED_SETUPS,
  deckFromRecommended,
  pickRecommendedForPlayerCount,
} from './recommendedSetups.js';
import { createDefaultRoleDeck } from './defaultRoles.js';

describe('recommendedSetups', () => {
  it('every setup only references catalog role ids', () => {
    const ids = new Set(createDefaultRoleDeck().map((r) => r.id));
    for (const setup of RECOMMENDED_SETUPS) {
      for (const id of Object.keys(setup.counts)) {
        assert.ok(ids.has(id), `unknown role id ${id} in ${setup.id}`);
      }
      const deck = deckFromRecommended(setup);
      const total = deck.reduce((s, r) => s + r.count, 0);
      assert.ok(
        total >= setup.minPlayers && total <= setup.maxPlayers,
        `${setup.id} copies=${total} outside ${setup.minPlayers}-${setup.maxPlayers}`,
      );
    }
  });

  it('pickRecommendedForPlayerCount returns matching band', () => {
    assert.equal(pickRecommendedForPlayerCount(8).id, 'table8');
    assert.equal(pickRecommendedForPlayerCount(12).id, 'table12');
    assert.equal(pickRecommendedForPlayerCount(3).id, 'table6');
  });
});
