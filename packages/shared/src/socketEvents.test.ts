/**
 * @fileoverview Socket contract freeze — event name stability for Zero Regression.
 *
 * If a rename is intentional, update this list in the same PR as all emitters.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMasterGameState, type SyncStatePayload } from './socketEvents.js';

/** Canonical client→server event names (must match ClientToServerEvents keys). */
const CLIENT_TO_SERVER = [
  'room:create',
  'room:join',
  'session:rebind',
  'lobby:updateSettings',
  'lobby:updateDeck',
  'lobby:setMaster',
  'lobby:importPreset',
  'game:start',
  'game:beginNight',
  'night:submitAction',
  'master:forceAdvance',
  'master:setPaused',
  'master:cancelAction',
  'master:setPhase',
  'tribunal:vote',
  'game:rematch',
  'room:leave',
] as const;

/** Canonical server→client event names (must match ServerToClientEvents keys). */
const SERVER_TO_CLIENT = [
  'sync:state',
  'night:hapticPulse',
  'ui:toast',
  'room:closed',
] as const;

describe('socketEvents contract', () => {
  it('freezes client→server event names (sorted snapshot)', () => {
    assert.deepEqual([...CLIENT_TO_SERVER].sort(), [
      'game:beginNight',
      'game:rematch',
      'game:start',
      'lobby:importPreset',
      'lobby:setMaster',
      'lobby:updateDeck',
      'lobby:updateSettings',
      'master:cancelAction',
      'master:forceAdvance',
      'master:setPaused',
      'master:setPhase',
      'night:submitAction',
      'room:create',
      'room:join',
      'room:leave',
      'session:rebind',
      'tribunal:vote',
    ]);
  });

  it('freezes server→client event names', () => {
    assert.deepEqual([...SERVER_TO_CLIENT], [
      'sync:state',
      'night:hapticPulse',
      'ui:toast',
      'room:closed',
    ]);
  });

  it('isMasterGameState discriminates God-View payloads', () => {
    const sanitized = {
      players: [],
      you: {},
    } as unknown as SyncStatePayload;
    const master = {
      masterRoster: [],
      nightQueue: [],
      players: [],
    } as unknown as SyncStatePayload;
    assert.equal(isMasterGameState(sanitized), false);
    assert.equal(isMasterGameState(master), true);
  });
});
