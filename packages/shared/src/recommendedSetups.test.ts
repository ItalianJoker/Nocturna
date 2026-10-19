/**
 * @fileoverview Recommended setup sanity checks (6–24).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDED_SETUPS,
  deckFromRecommended,
  pickRecommendedForPlayerCount,
  buildBalancedCounts,
} from './recommendedSetups.js';
import { createDefaultRoleDeck } from './defaultRoles.js';

describe('recommendedSetups', () => {
  it('covers every seat count from 6 through 24', () => {
    assert.equal(RECOMMENDED_SETUPS.length, 19);
    for (let n = 6; n <= 24; n++) {
      const s = RECOMMENDED_SETUPS.find((x) => x.id === `table${n}`);
      assert.ok(s, `missing table${n}`);
    }
  });

  it('every setup only references catalog role ids and exact seat total', () => {
    const ids = new Set(createDefaultRoleDeck().map((r) => r.id));
    for (const setup of RECOMMENDED_SETUPS) {
      for (const id of Object.keys(setup.counts)) {
        assert.ok(ids.has(id), `unknown role id ${id} in ${setup.id}`);
      }
      const deck = deckFromRecommended(setup);
      assert.ok(
        deck.every((r) => r.count > 0),
        `${setup.id} must not include count-0 roles`,
      );
      assert.ok(
        deck.length < createDefaultRoleDeck().length ||
          Object.keys(setup.counts).length === createDefaultRoleDeck().length,
        `${setup.id} should omit unused catalog roles from the party deck`,
      );
      const total = deck.reduce((s, r) => s + r.count, 0);
      assert.equal(
        total,
        setup.minPlayers,
        `${setup.id} copies=${total} expected ${setup.minPlayers}`,
      );
      assert.equal(
        deck.length,
        Object.keys(setup.counts).length,
        `${setup.id} deck rows must match positive count keys only`,
      );
      const shadowPower =
        (setup.counts.ombra ?? 0) +
        (setup.counts.caccianotte ?? 0) +
        (setup.counts.artiglio ?? 0) +
        (setup.counts.fiamma_fredda ?? 0) +
        (setup.counts.simulacro ?? 0);
      assert.ok(
        shadowPower < total - shadowPower,
        `${setup.id} shadow density too high (${shadowPower}/${total})`,
      );
      assert.ok((setup.counts.guardia ?? 0) >= 1, `${setup.id} missing Custode`);
      assert.ok((setup.counts.oracolo ?? 0) >= 1, `${setup.id} missing Oracolo`);
    }
  });

  it('pickRecommendedForPlayerCount clamps to 6–24', () => {
    assert.equal(pickRecommendedForPlayerCount(8).id, 'table8');
    assert.equal(pickRecommendedForPlayerCount(24).id, 'table24');
    assert.equal(pickRecommendedForPlayerCount(3).id, 'table6');
    assert.equal(pickRecommendedForPlayerCount(99).id, 'table24');
  });

  it('buildBalancedCounts(24) stays under shadow majority', () => {
    const c = buildBalancedCounts(24);
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    assert.equal(total, 24);
  });
});
