/**
 * @fileoverview Lobby + QR join portal — extreme mobile-first responsiveness.
 *
 * Join-via-QR must work on constrained phone browsers: safe-area padding,
 * ≥44px targets, fluid type, no horizontal overflow, fast first paint.
 */

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Download,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  createDefaultRoleDeck,
  DEFAULT_ROOM_SETTINGS,
  type RoleDefinition,
  type RolePreset,
  type RoomSettings,
} from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { RoleScheduleEditor } from './RoleScheduleEditor';
import { useAppStore } from '../store/appStore';

const PRESET_KEY = 'nocturna.presets.v1';

export function HomeGate() {
  const session = useAppStore((s) => s.session);
  const view = useAppStore((s) => s.view);
  const connected = useAppStore((s) => s.connected);

  if (session && view) {
    return <LobbyRoom />;
  }
  return <Welcome connected={connected} />;
}

function Welcome({ connected }: { connected: boolean }) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [name, setName] = useState('');
  const [pin, setPin] = useState(
    () => sessionStorage.getItem('nocturna.pendingPin') ?? '',
  );
  const [busy, setBusy] = useState(false);
  const setSession = useAppStore((s) => s.setSession);
  const setToast = useAppStore((s) => s.setToast);

  const create = () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    getSocket().emit(
      'room:create',
      { displayName: name.trim() },
      (res) => {
        setBusy(false);
        if (!res?.ok || !res.roomId || !res.playerId || !res.sessionToken) {
          setToast({
            level: 'error',
            message: res?.error ?? 'Creazione fallita',
          });
          return;
        }
        setSession({
          roomId: res.roomId,
          playerId: res.playerId,
          sessionToken: res.sessionToken,
          displayName: name.trim(),
        });
      },
    );
  };

  const join = () => {
    if (!name.trim() || !pin.trim() || busy) return;
    setBusy(true);
    getSocket().emit(
      'room:join',
      { roomId: pin.trim(), displayName: name.trim() },
      (res) => {
        setBusy(false);
        if (!res?.ok || !res.roomId || !res.playerId || !res.sessionToken) {
          setToast({
            level: 'error',
            message: res?.error ?? 'Ingresso fallito',
          });
          return;
        }
        sessionStorage.removeItem('nocturna.pendingPin');
        setSession({
          roomId: res.roomId,
          playerId: res.playerId,
          sessionToken: res.sessionToken,
          displayName: name.trim(),
        });
      },
    );
  };

  return (
    <div className="page-shell relative overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 0%, #3f1525 0%, transparent 55%), linear-gradient(180deg, #0c0a0e 0%, #000 100%)',
        }}
      />
      <div className="animate-rise">
        <p className="fluid-label text-[var(--nocturna-crimson-hot)]">
          Chi dorme non sopravvive
        </p>
        <h1 className="font-display fluid-hero mt-3 text-[var(--nocturna-paper)]">
          Nocturna
        </h1>
        <p className="mt-4 max-w-prose fluid-body text-stone-400">
          Deduzione sociale mobile-first. Notte stealth, narratore automatico o
          Master assistito — senza segnali che tradiscono chi è sveglio.
        </p>
      </div>

      <div
        className="relative z-10 mt-8 flex gap-1 rounded-full border border-white/10 bg-black/40 p-1"
        role="tablist"
        aria-label="Modalità accesso"
      >
        <button
          type="button"
          role="tab"
          data-testid="tab-join"
          aria-selected={mode === 'join'}
          aria-controls="access-panel"
          onClick={() => setMode('join')}
          className={`touch-target relative z-10 flex-1 cursor-pointer select-none rounded-full py-2.5 text-sm ${
            mode === 'join'
              ? 'bg-[var(--nocturna-crimson)] text-white'
              : 'text-stone-400'
          }`}
        >
          Entra
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-create"
          aria-selected={mode === 'create'}
          aria-controls="access-panel"
          onClick={() => setMode('create')}
          className={`touch-target relative z-10 flex-1 cursor-pointer select-none rounded-full py-2.5 text-sm ${
            mode === 'create'
              ? 'bg-[var(--nocturna-crimson)] text-white'
              : 'text-stone-400'
          }`}
        >
          Crea stanza
        </button>
      </div>

      <div id="access-panel" className="relative z-10">
        <label className="mt-6 block fluid-label text-stone-500">
          Nome al tavolo
          <input
            className="field-input mt-2 tracking-normal"
            style={{ letterSpacing: 'normal', textTransform: 'none' }}
            value={name}
            maxLength={24}
            autoComplete="nickname"
            enterKeyHint="next"
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Luca"
          />
        </label>

        {mode === 'join' && (
          <label className="mt-4 block fluid-label text-stone-500">
            PIN stanza
            <input
              className="field-input mt-2 text-center font-mono text-2xl tracking-[0.35em]"
              value={pin}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') join();
              }}
              placeholder="000000"
            />
          </label>
        )}

        <button
          type="button"
          disabled={busy || !connected}
          onClick={mode === 'join' ? join : create}
          className="btn-primary mt-8"
          data-testid="access-submit"
        >
          {busy
            ? 'Attendi…'
            : mode === 'join'
              ? 'Entra in stanza'
              : 'Apri lobby'}
        </button>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-600">
        {connected ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-600" /> Connesso
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5" /> Connessione…
          </>
        )}
      </p>
    </div>
  );
}

function LobbyRoom() {
  const view = useAppStore((s) => s.view)!;
  const session = useAppStore((s) => s.session)!;
  const draftDeck = useAppStore((s) => s.draftDeck);
  const setDraftDeck = useAppStore((s) => s.setDraftDeck);
  const clearGame = useAppStore((s) => s.clearGame);
  const setToast = useAppStore((s) => s.setToast);

  const me = view.players.find((p) => p.id === session.playerId);
  const isHost = !!me?.isHost;

  useEffect(() => {
    if (!isHost) return;
    if (view.hostDeck?.length) {
      setDraftDeck(view.hostDeck);
      return;
    }
    if (!draftDeck) {
      setDraftDeck(createDefaultRoleDeck());
    }
  }, [isHost, view.hostDeck, draftDeck, setDraftDeck]);

  const joinUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('pin', view.roomId);
    return url.toString();
  }, [view.roomId]);

  const patchSettings = (patch: Partial<RoomSettings>) => {
    getSocket().emit('lobby:updateSettings', { settings: patch });
  };

  const saveDeck = (deck: RoleDefinition[]) => {
    setDraftDeck(deck);
    getSocket().emit('lobby:updateDeck', { roleDeck: deck });
  };

  const exportPreset = () => {
    const preset: RolePreset = {
      name: view.settings.roomName,
      version: 1,
      settings: { ...DEFAULT_ROOM_SETTINGS, ...view.settings },
      roles: draftDeck ?? createDefaultRoleDeck(),
      exportedAt: Date.now(),
    };
    localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
    const blob = new Blob([JSON.stringify(preset, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nocturna-preset-${view.roomId}.json`;
    a.click();
    setToast({ level: 'info', message: 'Preset esportato.' });
  };

  const importPresetFile = async (file: File) => {
    const text = await file.text();
    const preset = JSON.parse(text) as RolePreset;
    getSocket().emit('lobby:importPreset', { preset }, (res) => {
      if (res?.ok) {
        setDraftDeck(preset.roles);
        setToast({ level: 'info', message: 'Preset importato.' });
      } else {
        setToast({ level: 'error', message: res?.error ?? 'Import fallito' });
      }
    });
  };

  return (
    <div className="page-shell gap-5">
      <header className="shrink-0">
        <p className="fluid-label text-stone-500">Lobby · PIN</p>
        <h1 className="font-display fluid-hero tracking-wide text-[var(--nocturna-paper)]">
          {view.roomId}
        </h1>
        <p className="mt-1 fluid-body text-stone-400 break-words">
          {view.settings.roomName}
        </p>
      </header>

      <div className="qr-block rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
        <div className="qr-block__code">
          <QRCodeSVG value={joinUrl} size={112} level="M" marginSize={0} />
        </div>
        <div className="min-w-0 flex-1 fluid-body text-stone-400">
          <p>Scansiona per entrare da qualsiasi telefono.</p>
          <button
            type="button"
            className="touch-target mt-2 inline-flex items-center gap-1 text-[var(--nocturna-amber)]"
            onClick={() => {
              void navigator.clipboard.writeText(view.roomId);
              setToast({ level: 'info', message: 'PIN copiato.' });
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copia PIN
          </button>
        </div>
      </div>

      <section className="shrink-0">
        <h2 className="font-display fluid-h2">Al tavolo</h2>
        <ul className="mt-2 max-h-[30dvh] space-y-1 overflow-y-auto overscroll-contain">
          {view.players.map((p) => (
            <li
              key={p.id}
              className="flex min-h-[var(--touch-min)] items-center justify-between gap-2 rounded-lg px-2 py-2 fluid-body"
            >
              <span className="truncate">
                {p.displayName}
                {p.isHost ? ' · Host' : ''}
                {p.isMaster ? ' · Master' : ''}
              </span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  p.isConnected ? 'bg-emerald-600' : 'bg-stone-700'
                }`}
              />
            </li>
          ))}
        </ul>
      </section>

      {isHost && (
        <div className="scroll-stack gap-5">
          <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
            <h2 className="font-display fluid-h2">Impostazioni Host</h2>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              Modalità
              <select
                className="field-input"
                value={view.settings.moderatorMode}
                onChange={(e) =>
                  patchSettings({
                    moderatorMode: e.target
                      .value as RoomSettings['moderatorMode'],
                  })
                }
              >
                <option value="AUTOMATED">Narratore automatico</option>
                <option value="ASSISTED">Master assistito</option>
              </select>
            </label>
            {view.settings.moderatorMode === 'ASSISTED' && (
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Master
                <select
                  className="field-input"
                  value={
                    view.players.find((p) => p.isMaster)?.id ?? session.playerId
                  }
                  onChange={(e) =>
                    getSocket().emit('lobby:setMaster', {
                      playerId: e.target.value,
                    })
                  }
                >
                  {view.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              Aptica
              <select
                className="field-input"
                value={view.settings.hapticPolicy}
                onChange={(e) =>
                  patchSettings({
                    hapticPolicy: e.target
                      .value as RoomSettings['hapticPolicy'],
                  })
                }
              >
                <option value="NONE">Nessuna vibrazione (default)</option>
                <option value="UNIVERSAL_HEARTBEAT">
                  Heartbeat universale
                </option>
              </select>
            </label>
            <label className="flex min-h-[var(--touch-min)] items-center justify-between gap-3 fluid-body text-stone-300">
              <span>Audio ambiente (AUTOMATED)</span>
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
                checked={view.settings.ambientAudioEnabled}
                onChange={(e) =>
                  patchSettings({ ambientAudioEnabled: e.target.checked })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              Visibilità voti
              <select
                className="field-input"
                value={view.settings.voteVisibility}
                onChange={(e) =>
                  patchSettings({
                    voteVisibility: e.target
                      .value as RoomSettings['voteVisibility'],
                  })
                }
              >
                <option value="SECRET">Segreta</option>
                <option value="PUBLIC">Palese</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              Pareggi tribunale
              <select
                className="field-input"
                value={view.settings.tieBreakPolicy}
                onChange={(e) =>
                  patchSettings({
                    tieBreakPolicy: e.target
                      .value as RoomSettings['tieBreakPolicy'],
                  })
                }
              >
                <option value="NO_ELIMINATION">Nessun rogo</option>
                <option value="RUNOFF">Ballottaggio</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button
                type="button"
                onClick={exportPreset}
                className="btn-ghost w-full flex-1"
              >
                <Download className="h-4 w-4" /> Esporta
              </button>
              <label className="btn-ghost w-full flex-1 cursor-pointer">
                <Upload className="h-4 w-4" /> Importa
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importPresetFile(f);
                  }}
                />
              </label>
            </div>
          </section>

          {draftDeck && (
            <RoleScheduleEditor deck={draftDeck} onChange={saveDeck} />
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              getSocket().emit('game:start', {}, (res) => {
                if (!res?.ok) {
                  setToast({
                    level: 'error',
                    message: res?.error ?? 'Avvio fallito',
                  });
                }
              })
            }
          >
            Distribuisci ruoli
          </button>
        </div>
      )}

      {!isHost && (
        <p className="text-center fluid-body text-stone-500">
          In attesa che l&apos;Host configuri e avvii la partita…
        </p>
      )}

      <button
        type="button"
        className="touch-target mt-auto text-center text-xs text-stone-600 underline"
        onClick={() => {
          getSocket().emit('room:leave', {});
          clearGame();
        }}
      >
        Esci dalla stanza
      </button>
    </div>
  );
}
