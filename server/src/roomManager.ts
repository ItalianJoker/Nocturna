/**
 * @fileoverview In-memory room registry for Nocturna.
 *
 * Persistence is intentionally process-local (`Map<RoomId, GameState>`).
 * This keeps the MVP zero-dependency and makes sensory sync deterministic
 * within a single Node process. Horizontal scale would require an adapter
 * (Redis) for Socket.io + shared room state — out of scope for v1.
 */

import { customAlphabet } from 'nanoid';
import {
  createDefaultRoleDeck,
  DEFAULT_ROOM_SETTINGS,
  type GameState,
  type Player,
  type PlayerId,
  type RoomId,
  type RoomSettings,
  type RoleDefinition,
  type SessionToken,
} from '@nocturna/shared';

const pinAlphabet = customAlphabet('0123456789', 6);
const tokenAlphabet = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  24,
);
const idAlphabet = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  12,
);

/** Active rooms keyed by PIN / room id. */
const rooms = new Map<RoomId, GameState>();

/** Reverse index: sessionToken → { roomId, playerId } for fast reconnect. */
const sessions = new Map<
  SessionToken,
  { roomId: RoomId; playerId: PlayerId }
>();

/** Node timeout handles keyed by room (cleared on phase change). */
const roomTimers = new Map<RoomId, NodeJS.Timeout>();

export function generateRoomId(): RoomId {
  let id = pinAlphabet();
  // Extremely unlikely collision loop for 6-digit space under casual load.
  while (rooms.has(id)) id = pinAlphabet();
  return id;
}

export function generatePlayerId(): PlayerId {
  return idAlphabet();
}

export function generateSessionToken(): SessionToken {
  return tokenAlphabet();
}

export function getRoom(roomId: RoomId): GameState | undefined {
  return rooms.get(roomId);
}

export function listRoomIds(): RoomId[] {
  return [...rooms.keys()];
}

export function deleteRoom(roomId: RoomId): void {
  const room = rooms.get(roomId);
  if (room) {
    for (const p of room.players.values()) {
      sessions.delete(p.sessionToken);
    }
  }
  clearRoomTimer(roomId);
  rooms.delete(roomId);
}

export function clearRoomTimer(roomId: RoomId): void {
  const t = roomTimers.get(roomId);
  if (t) clearTimeout(t);
  roomTimers.delete(roomId);
}

export function setRoomTimer(
  roomId: RoomId,
  delayMs: number,
  fn: () => void,
): void {
  clearRoomTimer(roomId);
  const token = idAlphabet();
  const room = rooms.get(roomId);
  if (room) room.timerToken = token;
  const handle = setTimeout(() => {
    const current = rooms.get(roomId);
    // Ignore stale timers that lost a race against a newer schedule.
    if (!current || current.timerToken !== token) return;
    fn();
  }, delayMs);
  roomTimers.set(roomId, handle);
}

/**
 * Creates a lobby room owned by the Host player.
 */
export function createRoom(args: {
  displayName: string;
  settings?: Partial<RoomSettings>;
  roleDeck?: RoleDefinition[];
}): { room: GameState; host: Player } {
  const roomId = generateRoomId();
  const hostId = generatePlayerId();
  const sessionToken = generateSessionToken();
  const settings: RoomSettings = {
    ...DEFAULT_ROOM_SETTINGS,
    ...args.settings,
    // Enforce legal haptic policies only.
    hapticPolicy:
      args.settings?.hapticPolicy === 'UNIVERSAL_HEARTBEAT'
        ? 'UNIVERSAL_HEARTBEAT'
        : 'NONE',
  };

  const host: Player = {
    id: hostId,
    displayName: args.displayName.trim().slice(0, 24) || 'Host',
    sessionToken,
    socketId: null,
    isHost: true,
    isMaster: settings.moderatorMode === 'ASSISTED',
    isConnected: true,
    isAlive: true,
    roleId: null,
    isProtected: false,
    markedForDeath: false,
    joinedAt: Date.now(),
  };

  const room: GameState = {
    roomId,
    createdAt: Date.now(),
    hostPlayerId: hostId,
    settings,
    phase: 'LOBBY',
    phaseEndsAt: null,
    nightNumber: 0,
    dayNumber: 0,
    players: new Map([[hostId, host]]),
    roleDeck: args.roleDeck?.length
      ? args.roleDeck.map((r) => ({
          ...r,
          wakeSchedule: { ...r.wakeSchedule },
        }))
      : createDefaultRoleDeck(),
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
  };

  rooms.set(roomId, room);
  sessions.set(sessionToken, { roomId, playerId: hostId });
  return { room, host };
}

/**
 * Adds a player to a lobby (or rebinds if sessionToken matches).
 */
export function joinRoom(args: {
  roomId: RoomId;
  displayName: string;
  sessionToken?: SessionToken;
}): { room: GameState; player: Player } | { ok: false; error: string } {
  const room = rooms.get(args.roomId);
  if (!room) return { ok: false as const, error: 'Stanza non trovata.' };

  if (args.sessionToken) {
    const existing = [...room.players.values()].find(
      (p) => p.sessionToken === args.sessionToken,
    );
    if (existing) {
      existing.isConnected = true;
      existing.displayName =
        args.displayName.trim().slice(0, 24) || existing.displayName;
      return { room, player: existing };
    }
  }

  if (room.phase !== 'LOBBY' && !room.settings.allowLateJoin) {
    return { ok: false as const, error: 'La partita è già iniziata.' };
  }

  const playerId = generatePlayerId();
  const sessionToken = generateSessionToken();
  const player: Player = {
    id: playerId,
    displayName: args.displayName.trim().slice(0, 24) || 'Giocatore',
    sessionToken,
    socketId: null,
    isHost: false,
    isMaster: false,
    isConnected: true,
    isAlive: true,
    roleId: null,
    isProtected: false,
    markedForDeath: false,
    joinedAt: Date.now(),
  };
  room.players.set(playerId, player);
  sessions.set(sessionToken, { roomId: room.roomId, playerId });
  return { room, player };
}

export function lookupSession(
  sessionToken: SessionToken,
): { roomId: RoomId; playerId: PlayerId } | undefined {
  return sessions.get(sessionToken);
}

export function bindSocket(
  roomId: RoomId,
  playerId: PlayerId,
  socketId: string,
): Player | undefined {
  const room = rooms.get(roomId);
  const player = room?.players.get(playerId);
  if (!player) return undefined;
  player.socketId = socketId;
  player.isConnected = true;
  return player;
}

export function markDisconnected(socketId: string): {
  roomId: RoomId;
  playerId: PlayerId;
} | null {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        player.socketId = null;
        player.isConnected = false;
        return { roomId: room.roomId, playerId: player.id };
      }
    }
  }
  return null;
}

/**
 * Expands the role deck `count` fields into a flat shuffled card list
 * and deals one card to each non-master player.
 */
export function dealRoles(room: GameState): { ok: true } | { ok: false; error: string } {
  const recipients = [...room.players.values()].filter((p) => !p.isMaster);
  const cards: string[] = [];
  for (const role of room.roleDeck) {
    for (let i = 0; i < role.count; i++) cards.push(role.id);
  }
  if (cards.length < recipients.length) {
    return {
      ok: false as const,
      error: `Carte insufficienti: ${cards.length} ruoli per ${recipients.length} giocatori.`,
    };
  }
  if (cards.length > recipients.length) {
    // Trim excess randomly so Host over-counts don't crash start.
    shuffleInPlace(cards);
    cards.length = recipients.length;
  } else {
    shuffleInPlace(cards);
  }
  shuffleInPlace(recipients);
  recipients.forEach((p, i) => {
    p.roleId = cards[i]!;
    p.isAlive = true;
    p.isProtected = false;
    p.markedForDeath = false;
  });
  for (const p of room.players.values()) {
    if (p.isMaster) {
      p.roleId = null;
      p.isAlive = true;
    }
  }
  return { ok: true };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Resets runtime fields for a rematch while keeping roster + settings.
 */
export function resetForRematch(room: GameState): void {
  clearRoomTimer(room.roomId);
  room.phase = 'LOBBY';
  room.phaseEndsAt = null;
  room.nightNumber = 0;
  room.dayNumber = 0;
  room.nightQueue = [];
  room.currentTurnIndex = 0;
  room.pendingActions = [];
  room.pendingInvestigations.clear();
  room.tribunalVotes.clear();
  room.runoffCandidates = null;
  room.dawnVictims = [];
  room.dawnSaved = [];
  room.isPaused = false;
  room.winningFaction = null;
  room.winningPlayerIds = [];
  room.actionLog = [];
  room.timerToken = null;
  for (const p of room.players.values()) {
    p.roleId = null;
    p.isAlive = true;
    p.isProtected = false;
    p.markedForDeath = false;
  }
}
