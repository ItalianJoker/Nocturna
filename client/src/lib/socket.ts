/**
 * @fileoverview Socket.io singleton for the Nocturna SPA.
 *
 * Reuses one connection across route changes. On connect, if a sessionToken
 * exists in localStorage, automatically emits `session:rebind` so lock-screen
 * recoveries restore the correct sanitised (or master) view.
 */

import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nocturna/shared';
import { useAppStore } from '../store/appStore';
import { playAmbient, stopAmbient } from '../lib/audio';
import { vibrateUniversal } from '../lib/haptics';

export type NocturnaSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: NocturnaSocket | null = null;

export function getSocket(): NocturnaSocket {
  if (socket) return socket;

  const url = import.meta.env.VITE_SOCKET_URL ?? undefined;
  socket = io(url, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4_000,
  }) as NocturnaSocket;

  const store = useAppStore.getState;

  socket.on('connect', () => {
    store().setConnected(true);
    const session = store().session ?? store().hydrateSession();
    if (session?.roomId && session.sessionToken) {
      socket!.emit(
        'session:rebind',
        { roomId: session.roomId, sessionToken: session.sessionToken },
        (res) => {
          if (!res?.ok) {
            // Stale session — clear so the user can rejoin cleanly.
            store().setToast({
              level: 'warn',
              message: res?.error ?? 'Sessione scaduta. Rientra con il PIN.',
            });
          }
        },
      );
    }
  });

  socket.on('disconnect', () => {
    store().setConnected(false);
  });

  socket.on('sync:state', (view) => {
    store().setView(view);
    const ambientOn =
      view.settings.ambientAudioEnabled &&
      view.settings.moderatorMode === 'AUTOMATED' &&
      view.phase === 'NIGHT';
    if (ambientOn) playAmbient();
    else stopAmbient();

    if (
      view.hapticPulseSeq > 0 &&
      view.hapticPulseSeq !== store().lastHapticSeq &&
      view.settings.hapticPolicy === 'UNIVERSAL_HEARTBEAT'
    ) {
      store().setLastHapticSeq(view.hapticPulseSeq);
      // Pulse also arrives via dedicated event; this is a safety net on sync.
    }
  });

  socket.on('night:hapticPulse', ({ seq, pattern }) => {
    if (seq === store().lastHapticSeq) return;
    store().setLastHapticSeq(seq);
    vibrateUniversal(pattern);
  });

  socket.on('ui:toast', (toast) => {
    store().setToast(toast);
  });

  socket.on('room:closed', ({ reason }) => {
    store().setToast({ level: 'warn', message: reason });
    store().clearGame();
  });

  return socket;
}
