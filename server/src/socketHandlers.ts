/**
 * @fileoverview Socket.io event handlers for Nocturna.
 *
 * Each handler validates authority (host / master / actor), mutates the
 * in-memory room via the FSM, then broadcasts a *per-socket* sanitised view.
 * The broadcast helper never emits a single shared GameState object.
 */

import type { Server, Socket } from 'socket.io';
import {
  createDefaultRoleDeck,
  viewForPlayer,
  type ClientToServerEvents,
  type InterServerEvents,
  type RoleDefinition,
  type RoomSettings,
  type ServerToClientEvents,
  type SocketData,
} from '@nocturna/shared';
import {
  bindSocket,
  createRoom,
  getRoom,
  joinRoom,
  lookupSession,
  markDisconnected,
} from './roomManager.js';
import {
  beginFirstNight,
  castTribunalVote,
  configureFsmIO,
  masterCancelAction,
  masterForceAdvance,
  masterSetPaused,
  masterSetPhase,
  rematch,
  startGame,
  submitNightAction,
} from './gameFsm.js';

export type NocturnaServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type NocturnaSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Emits the correct view to every connected member of a room.
 */
export function broadcastRoomState(io: NocturnaServer, roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    try {
      const view = viewForPlayer(room, player.id);
      io.to(player.socketId).emit('sync:state', view);
    } catch {
      // Skip viewers that somehow lack roster entries.
    }
  }
}

export function registerSocketHandlers(io: NocturnaServer): void {
  configureFsmIO({
    broadcast: (roomId) => broadcastRoomState(io, roomId),
    haptic: (roomId, seq, pattern) => {
      io.to(roomId).emit('night:hapticPulse', { seq, pattern });
    },
  });

  io.on('connection', (socket: NocturnaSocket) => {
    socket.on('room:create', (payload, ack) => {
      try {
        const { room, host } = createRoom({
          displayName: payload.displayName,
          settings: payload.settings,
          roleDeck: payload.roleDeck,
        });
        host.socketId = socket.id;
        socket.data.playerId = host.id;
        socket.data.roomId = room.roomId;
        socket.data.sessionToken = host.sessionToken;
        void socket.join(room.roomId);
        ack?.({
          ok: true,
          roomId: room.roomId,
          playerId: host.id,
          sessionToken: host.sessionToken,
        });
        broadcastRoomState(io, room.roomId);
      } catch (err) {
        ack?.({
          ok: false,
          error: err instanceof Error ? err.message : 'Errore creazione stanza',
        });
      }
    });

    socket.on('room:join', (payload, ack) => {
      const result = joinRoom({
        roomId: payload.roomId.trim(),
        displayName: payload.displayName,
        sessionToken: payload.sessionToken,
      });
      if ('error' in result) {
        ack?.({ ok: false, error: result.error });
        return;
      }
      const { room, player } = result;
      player.socketId = socket.id;
      socket.data.playerId = player.id;
      socket.data.roomId = room.roomId;
      socket.data.sessionToken = player.sessionToken;
      void socket.join(room.roomId);
      ack?.({
        ok: true,
        roomId: room.roomId,
        playerId: player.id,
        sessionToken: player.sessionToken,
      });
      broadcastRoomState(io, room.roomId);
    });

    socket.on('session:rebind', (payload, ack) => {
      const lookup = lookupSession(payload.sessionToken);
      if (!lookup || lookup.roomId !== payload.roomId) {
        ack?.({ ok: false, error: 'Sessione non valida.' });
        return;
      }
      const player = bindSocket(lookup.roomId, lookup.playerId, socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'Giocatore non trovato.' });
        return;
      }
      socket.data.playerId = player.id;
      socket.data.roomId = lookup.roomId;
      socket.data.sessionToken = player.sessionToken;
      void socket.join(lookup.roomId);
      ack?.({ ok: true });
      broadcastRoomState(io, lookup.roomId);
    });

    socket.on('lobby:updateSettings', (payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      if (room.phase !== 'LOBBY') {
        ack?.({ ok: false, error: 'Solo in lobby.' });
        return;
      }
      const next: RoomSettings = {
        ...room.settings,
        ...payload.settings,
        hapticPolicy:
          payload.settings.hapticPolicy === 'UNIVERSAL_HEARTBEAT'
            ? 'UNIVERSAL_HEARTBEAT'
            : payload.settings.hapticPolicy === 'NONE'
              ? 'NONE'
              : room.settings.hapticPolicy,
      };
      room.settings = next;

      if (next.moderatorMode === 'AUTOMATED') {
        for (const p of room.players.values()) p.isMaster = false;
      } else if (next.moderatorMode === 'ASSISTED') {
        // Default Master = Host if none designated.
        const hasMaster = [...room.players.values()].some((p) => p.isMaster);
        if (!hasMaster) {
          const host = room.players.get(room.hostPlayerId);
          if (host) host.isMaster = true;
        }
      }
      broadcastRoomState(io, room.roomId);
      ack?.({ ok: true });
    });

    socket.on('lobby:updateDeck', (payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      if (room.phase !== 'LOBBY') {
        ack?.({ ok: false, error: 'Solo in lobby.' });
        return;
      }
      room.roleDeck = sanitizeDeck(payload.roleDeck);
      broadcastRoomState(io, room.roomId);
      ack?.({ ok: true });
    });

    socket.on('lobby:setMaster', (payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      if (room.phase !== 'LOBBY') {
        ack?.({ ok: false, error: 'Solo in lobby.' });
        return;
      }
      if (room.settings.moderatorMode !== 'ASSISTED') {
        ack?.({ ok: false, error: 'Solo in modalità ASSISTED.' });
        return;
      }
      for (const p of room.players.values()) p.isMaster = false;
      if (payload.playerId) {
        const target = room.players.get(payload.playerId);
        if (!target) {
          ack?.({ ok: false, error: 'Giocatore non trovato.' });
          return;
        }
        target.isMaster = true;
      } else {
        const host = room.players.get(room.hostPlayerId);
        if (host) host.isMaster = true;
      }
      broadcastRoomState(io, room.roomId);
      ack?.({ ok: true });
    });

    socket.on('lobby:importPreset', (payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      if (room.phase !== 'LOBBY') {
        ack?.({ ok: false, error: 'Solo in lobby.' });
        return;
      }
      const preset = payload.preset;
      if (!preset?.roles?.length) {
        ack?.({ ok: false, error: 'Preset non valido.' });
        return;
      }
      room.roleDeck = sanitizeDeck(preset.roles);
      if (preset.settings) {
        room.settings = {
          ...room.settings,
          ...preset.settings,
          hapticPolicy:
            preset.settings.hapticPolicy === 'UNIVERSAL_HEARTBEAT'
              ? 'UNIVERSAL_HEARTBEAT'
              : 'NONE',
        };
      }
      broadcastRoomState(io, room.roomId);
      ack?.({ ok: true });
    });

    socket.on('game:start', (_payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      const result = startGame(room);
      ack?.(result);
    });

    socket.on('game:beginNight', (_payload, ack) => {
      const ctx = requireHostOrMaster(socket);
      if ('error' in ctx) {
        ack?.(ctx);
        return;
      }
      const result = beginFirstNight(ctx);
      ack?.(result);
    });

    socket.on('night:submitAction', (payload, ack) => {
      const room = requirePlayer(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      const playerId = socket.data.playerId!;
      const result = submitNightAction(room, playerId, payload);
      ack?.(result);
    });

    socket.on('master:forceAdvance', (_payload, ack) => {
      const room = requireMaster(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      ack?.(masterForceAdvance(room));
    });

    socket.on('master:setPaused', (payload, ack) => {
      const room = requireMaster(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      ack?.(masterSetPaused(room, payload.paused));
    });

    socket.on('master:cancelAction', (payload, ack) => {
      const room = requireMaster(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      ack?.(masterCancelAction(room, payload.actionId));
    });

    socket.on('master:setPhase', (payload, ack) => {
      const room = requireMaster(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      ack?.(masterSetPhase(room, payload.phase));
    });

    socket.on('tribunal:vote', (payload, ack) => {
      const room = requirePlayer(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      ack?.(
        castTribunalVote(room, socket.data.playerId!, payload.targetPlayerId),
      );
    });

    socket.on('game:rematch', (_payload, ack) => {
      const room = requireHost(socket);
      if ('error' in room) {
        ack?.(room);
        return;
      }
      rematch(room);
      ack?.({ ok: true });
    });

    socket.on('room:leave', (_payload, ack) => {
      const roomId = socket.data.roomId;
      const playerId = socket.data.playerId;
      if (roomId && playerId) {
        const room = getRoom(roomId);
        if (room?.phase === 'LOBBY') {
          const player = room.players.get(playerId);
          if (player && !player.isHost) {
            room.players.delete(playerId);
          } else if (player) {
            player.isConnected = false;
            player.socketId = null;
          }
          broadcastRoomState(io, roomId);
        } else if (room) {
          const player = room.players.get(playerId);
          if (player) {
            player.isConnected = false;
            player.socketId = null;
          }
          broadcastRoomState(io, roomId);
        }
      }
      void socket.leave(roomId ?? '');
      socket.data = {};
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      const info = markDisconnected(socket.id);
      if (info) broadcastRoomState(io, info.roomId);
    });
  });
}

function requirePlayer(
  socket: NocturnaSocket,
): ReturnType<typeof getRoom> extends infer R
  ? NonNullable<R> | { error: string; ok: false }
  : never {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  if (!roomId || !playerId) {
    return { ok: false, error: 'Non autenticato.' };
  }
  const room = getRoom(roomId);
  if (!room || !room.players.has(playerId)) {
    return { ok: false, error: 'Stanza non valida.' };
  }
  return room;
}

function requireHost(socket: NocturnaSocket) {
  const room = requirePlayer(socket);
  if ('error' in room) return room;
  const player = room.players.get(socket.data.playerId!);
  if (!player?.isHost) return { ok: false as const, error: 'Solo l\'Host.' };
  return room;
}

function requireMaster(socket: NocturnaSocket) {
  const room = requirePlayer(socket);
  if ('error' in room) return room;
  const player = room.players.get(socket.data.playerId!);
  if (!player?.isMaster || room.settings.moderatorMode !== 'ASSISTED') {
    return { ok: false as const, error: 'Solo il Master.' };
  }
  return room;
}

function requireHostOrMaster(socket: NocturnaSocket) {
  const room = requirePlayer(socket);
  if ('error' in room) return room;
  const player = room.players.get(socket.data.playerId!);
  if (player?.isHost || player?.isMaster) return room;
  return { ok: false as const, error: 'Permesso negato.' };
}

function sanitizeDeck(deck: RoleDefinition[]): RoleDefinition[] {
  if (!Array.isArray(deck) || deck.length === 0) {
    return createDefaultRoleDeck();
  }
  return deck.map((r) => ({
    ...r,
    id: String(r.id).slice(0, 64),
    name: String(r.name).slice(0, 48),
    description: String(r.description).slice(0, 500),
    count: Math.max(0, Math.min(20, Number(r.count) || 0)),
    wakeSchedule: {
      ...r.wakeSchedule,
      priority: Number(r.wakeSchedule?.priority) || 50,
      timeMaskingDuration: Math.max(
        0,
        Number(r.wakeSchedule?.timeMaskingDuration) || 20_000,
      ),
    },
  }));
}
