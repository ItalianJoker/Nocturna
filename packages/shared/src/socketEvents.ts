/**
 * @fileoverview Typed Socket.io contract for Nocturna client ↔ server.
 *
 * Event names are verb-oriented and grouped by domain. Synchronous sensory
 * events (`night:hapticPulse`, `sync:state`) are designed so every connected
 * client receives the same impulse at the same logical tick.
 */

import type {
  MasterGameState,
  PendingAction,
  PlayerId,
  RoleDefinition,
  RolePreset,
  RoomId,
  RoomSettings,
  SanitizedGameState,
  SessionToken,
} from './types.js';

/** Discriminated union of views a client may receive on sync. */
export type SyncStatePayload = SanitizedGameState | MasterGameState;

export function isMasterGameState(
  state: SyncStatePayload,
): state is MasterGameState {
  return 'masterRoster' in state && 'nightQueue' in state;
}

/** Events the client emits toward the server. */
export interface ClientToServerEvents {
  /** Create a new room; server replies with roomId + host session. */
  'room:create': (
    payload: {
      displayName: string;
      settings?: Partial<RoomSettings>;
      roleDeck?: RoleDefinition[];
    },
    ack?: (response: RoomCreateAck) => void,
  ) => void;

  /** Join an existing room by PIN. */
  'room:join': (
    payload: {
      roomId: RoomId;
      displayName: string;
      sessionToken?: SessionToken;
    },
    ack?: (response: RoomJoinAck) => void,
  ) => void;

  /** Rebind this socket to an existing session after reconnect. */
  'session:rebind': (
    payload: { roomId: RoomId; sessionToken: SessionToken },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host updates lobby settings. */
  'lobby:updateSettings': (
    payload: { settings: Partial<RoomSettings> },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host replaces / edits the role deck + wake schedule. */
  'lobby:updateDeck': (
    payload: { roleDeck: RoleDefinition[] },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Designate or clear the Master (ASSISTED mode). */
  'lobby:setMaster': (
    payload: { playerId: PlayerId | null },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host imports a JSON preset. */
  'lobby:importPreset': (
    payload: { preset: RolePreset },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host starts role distribution. */
  'game:start': (
    payload: Record<string, never>,
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host advances from ROLE_REVEAL into the first night. */
  'game:beginNight': (
    payload: Record<string, never>,
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Active night actor submits their action. */
  'night:submitAction': (
    payload: {
      turnId: string;
      targetPlayerId?: PlayerId | null;
      /** For PASSIVE_INFO / confirm-only wakes. */
      confirm?: boolean;
    },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Master forces the current night micro-turn to advance. */
  'master:forceAdvance': (
    payload: Record<string, never>,
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Master pauses or resumes the active timer. */
  'master:setPaused': (
    payload: { paused: boolean },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Master cancels a pending night action before dawn flush. */
  'master:cancelAction': (
    payload: { actionId: string },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Master opens discussion / tribunal manually in ASSISTED mode. */
  'master:setPhase': (
    payload: { phase: 'DISCUSSION' | 'TRIBUNAL' | 'NIGHT' },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Cast a tribunal vote. */
  'tribunal:vote': (
    payload: { targetPlayerId: PlayerId | 'ABSTAIN' },
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Host requests rematch with same room + settings. */
  'game:rematch': (
    payload: Record<string, never>,
    ack?: (response: { ok: boolean; error?: string }) => void,
  ) => void;

  /** Explicit leave (clears membership if still in lobby). */
  'room:leave': (
    payload: Record<string, never>,
    ack?: (response: { ok: boolean }) => void,
  ) => void;
}

export interface RoomCreateAck {
  ok: boolean;
  roomId?: RoomId;
  playerId?: PlayerId;
  sessionToken?: SessionToken;
  error?: string;
}

export interface RoomJoinAck {
  ok: boolean;
  roomId?: RoomId;
  playerId?: PlayerId;
  sessionToken?: SessionToken;
  error?: string;
}

/** Events the server emits toward clients. */
export interface ServerToClientEvents {
  /**
   * Authoritative view for this socket.
   * Always sanitised per-recipient — never a shared global dump.
   */
  'sync:state': (payload: SyncStatePayload) => void;

  /**
   * Universal haptic heartbeat. Emitted to *every* socket in the room at the
   * same tick when `hapticPolicy === 'UNIVERSAL_HEARTBEAT'`. Clients must not
   * invent their own vibration on role wake.
   */
  'night:hapticPulse': (payload: {
    seq: number;
    /** Vibration pattern in ms, e.g. [80, 40, 80]. */
    pattern: number[];
  }) => void;

  /** Soft toast / banner — never used for night role identity. */
  'ui:toast': (payload: { level: 'info' | 'warn' | 'error'; message: string }) => void;

  /** Room destroyed or kicked. */
  'room:closed': (payload: { reason: string }) => void;
}

/** Empty inter-server events map (single-process in-memory rooms). */
export type InterServerEvents = Record<string, never>;

/** Data attached to each socket after successful join / rebind. */
export interface SocketData {
  playerId?: PlayerId;
  roomId?: RoomId;
  sessionToken?: SessionToken;
}

/** Re-export PendingAction for handler convenience. */
export type { PendingAction };
