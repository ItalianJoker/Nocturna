/**
 * @fileoverview Zustand client store for Nocturna.
 *
 * Holds only local session concerns + the last sanitised (or master) view
 * received from the server. No game-rule computation lives here.
 */

import { create } from 'zustand';
import type {
  MasterGameState,
  RoleDefinition,
  SyncStatePayload,
} from '@nocturna/shared';
import { isMasterGameState } from '@nocturna/shared';

const STORAGE_KEY = 'nocturna.session.v1';

export interface LocalSession {
  roomId: string;
  playerId: string;
  sessionToken: string;
  displayName: string;
}

interface AppState {
  connected: boolean;
  session: LocalSession | null;
  view: SyncStatePayload | null;
  toast: { level: 'info' | 'warn' | 'error'; message: string } | null;
  /** Host-only draft deck while editing in lobby (mirrored to server on save). */
  draftDeck: RoleDefinition[] | null;
  lastHapticSeq: number;
  setConnected: (v: boolean) => void;
  setSession: (s: LocalSession | null) => void;
  hydrateSession: () => LocalSession | null;
  setView: (v: SyncStatePayload) => void;
  setToast: (t: AppState['toast']) => void;
  setDraftDeck: (d: RoleDefinition[] | null) => void;
  setLastHapticSeq: (n: number) => void;
  clearGame: () => void;
}

function readStorage(): LocalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
}

function writeStorage(session: LocalSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export const useAppStore = create<AppState>((set) => ({
  connected: false,
  session: null,
  view: null,
  toast: null,
  draftDeck: null,
  lastHapticSeq: 0,
  setConnected: (connected) => set({ connected }),
  setSession: (session) => {
    writeStorage(session);
    set({ session });
  },
  hydrateSession: () => {
    const session = readStorage();
    set({ session });
    return session;
  },
  setView: (view) => set({ view }),
  setToast: (toast) => set({ toast }),
  setDraftDeck: (draftDeck) => set({ draftDeck }),
  setLastHapticSeq: (lastHapticSeq) => set({ lastHapticSeq }),
  clearGame: () => {
    writeStorage(null);
    set({ session: null, view: null, draftDeck: null });
  },
}));

export function selectIsMasterView(
  view: SyncStatePayload | null,
): view is MasterGameState {
  return !!view && isMasterGameState(view);
}
