/**
 * @fileoverview Lobby + QR join portal — LAN-only advertise, i18n, Host settings.
 *
 * QR / join links NEVER use localhost or loopback. The advertise base comes
 * from `/api/host-info` (LAN IP + configured port, or Host override).
 */

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Upload, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createDefaultRoleDeck,
  DEFAULT_ROOM_SETTINGS,
  type RoleDefinition,
  type RolePreset,
  type RoomSettings,
} from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { RoleScheduleEditor } from './RoleScheduleEditor';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAppStore } from '../store/appStore';
import {
  buildJoinUrl,
  useJoinAdvertise,
} from '../hooks/useJoinAdvertise';

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
  const { t } = useTranslation();
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
            message: res?.error ?? t('welcome.createFailed'),
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
            message: res?.error ?? t('welcome.joinFailed'),
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
    <div className="page-shell relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 0%, #3f1525 0%, transparent 55%), linear-gradient(180deg, #0c0a0e 0%, #000 100%)',
        }}
      />
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="animate-rise">
        <p className="fluid-label text-[var(--nocturna-crimson-hot)]">
          {t('app.tagline')}
        </p>
        <h1 className="font-display fluid-hero mt-3 text-[var(--nocturna-paper)]">
          {t('app.name')}
        </h1>
        <p className="mt-4 max-w-prose fluid-body text-stone-400">
          {t('welcome.blurb')}
        </p>
      </div>

      <div
        className="relative z-10 mt-8 flex gap-1 rounded-full border border-white/10 bg-black/40 p-1"
        role="tablist"
        aria-label={t('welcome.tabJoin')}
      >
        <button
          type="button"
          role="tab"
          data-testid="tab-join"
          aria-selected={mode === 'join'}
          onClick={() => setMode('join')}
          className={`touch-target relative z-10 flex-1 cursor-pointer select-none rounded-full py-2.5 text-sm ${
            mode === 'join'
              ? 'bg-[var(--nocturna-crimson)] text-white'
              : 'text-stone-400'
          }`}
        >
          {t('welcome.tabJoin')}
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-create"
          aria-selected={mode === 'create'}
          onClick={() => setMode('create')}
          className={`touch-target relative z-10 flex-1 cursor-pointer select-none rounded-full py-2.5 text-sm ${
            mode === 'create'
              ? 'bg-[var(--nocturna-crimson)] text-white'
              : 'text-stone-400'
          }`}
        >
          {t('welcome.tabCreate')}
        </button>
      </div>

      <div id="access-panel" className="relative z-10">
        <label className="mt-6 block fluid-label text-stone-500">
          {t('welcome.displayName')}
          <input
            className="field-input mt-2 tracking-normal"
            style={{ letterSpacing: 'normal', textTransform: 'none' }}
            value={name}
            maxLength={24}
            autoComplete="nickname"
            enterKeyHint="next"
            onChange={(e) => setName(e.target.value)}
            placeholder={t('welcome.displayNamePlaceholder')}
          />
        </label>

        {mode === 'join' && (
          <label className="mt-4 block fluid-label text-stone-500">
            {t('welcome.pin')}
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
            ? t('welcome.wait')
            : mode === 'join'
              ? t('welcome.enterRoom')
              : t('welcome.openLobby')}
        </button>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-stone-600">
        {connected ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-600" /> {t('app.connected')}
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5" /> {t('app.connecting')}
          </>
        )}
      </p>
    </div>
  );
}

function msToSec(ms: number): number {
  return Math.round(ms / 1000);
}

function LobbyRoom() {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.view)!;
  const session = useAppStore((s) => s.session)!;
  const draftDeck = useAppStore((s) => s.draftDeck);
  const setDraftDeck = useAppStore((s) => s.setDraftDeck);
  const clearGame = useAppStore((s) => s.clearGame);
  const setToast = useAppStore((s) => s.setToast);
  const advertise = useJoinAdvertise();

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
    if (!advertise.base) return null;
    try {
      return buildJoinUrl(advertise.base, view.roomId);
    } catch {
      return null;
    }
  }, [advertise.base, view.roomId]);

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
    setToast({ level: 'info', message: t('lobby.presetExported') });
  };

  const importPresetFile = async (file: File) => {
    const text = await file.text();
    const preset = JSON.parse(text) as RolePreset;
    getSocket().emit('lobby:importPreset', { preset }, (res) => {
      if (res?.ok) {
        setDraftDeck(preset.roles);
        setToast({ level: 'info', message: t('lobby.presetImported') });
      } else {
        setToast({
          level: 'error',
          message: res?.error ?? t('lobby.importFailed'),
        });
      }
    });
  };

  return (
    <div className={`page-shell gap-5 ${isHost ? 'page-shell--host' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <header className="min-w-0 shrink">
          <p className="fluid-label text-stone-500">{t('lobby.title')}</p>
          <h1 className="font-display fluid-hero tracking-wide text-[var(--nocturna-paper)]">
            {view.roomId}
          </h1>
          <p className="mt-1 fluid-body text-stone-400 break-words">
            {view.settings.roomName}
          </p>
        </header>
        <LanguageSwitcher />
      </div>

      <div className="desktop-split">
        <div className="desktop-split__main space-y-5">
          <div className="qr-block rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
            {joinUrl ? (
              <div className="qr-block__code">
                <QRCodeSVG value={joinUrl} size={112} level="M" marginSize={0} />
              </div>
            ) : (
              <div className="flex min-h-[112px] min-w-[112px] items-center justify-center rounded-xl border border-rose-900/50 bg-rose-950/40 p-2 text-center text-xs text-rose-200">
                {t('lobby.qrUnavailable')}
              </div>
            )}
            <div className="min-w-0 flex-1 fluid-body text-stone-400">
              <p>{t('lobby.scanQr')}</p>
              {joinUrl ? (
                <p className="mt-2 break-all font-mono text-xs text-stone-500">
                  {joinUrl}
                </p>
              ) : (
                <p className="mt-2 text-sm text-rose-300">
                  {advertise.error ?? t('lobby.lanError')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="touch-target inline-flex items-center gap-1 text-[var(--nocturna-amber)]"
                  onClick={() => {
                    void navigator.clipboard.writeText(view.roomId);
                    setToast({ level: 'info', message: t('lobby.pinCopied') });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> {t('lobby.copyPin')}
                </button>
                {joinUrl && (
                  <button
                    type="button"
                    className="touch-target inline-flex items-center gap-1 text-[var(--nocturna-amber)]"
                    onClick={() => {
                      void navigator.clipboard.writeText(joinUrl);
                      setToast({ level: 'info', message: t('lobby.linkCopied') });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> {t('lobby.copyLink')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <section className="shrink-0">
            <h2 className="font-display fluid-h2">{t('lobby.atTable')}</h2>
            <ul className="list-pane mt-2 space-y-1">
              {view.players.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-[var(--touch-min)] items-center justify-between gap-2 rounded-lg px-2 py-2 fluid-body"
                >
                  <span className="truncate">
                    {p.displayName}
                    {p.isHost ? ` · ${t('lobby.host')}` : ''}
                    {p.isMaster ? ` · ${t('lobby.master')}` : ''}
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
        </div>

        {isHost && (
          <div className="desktop-split__side scroll-stack gap-5">
            <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4 lg:p-5">
              <h2 className="font-display fluid-h2">{t('lobby.hostSettings')}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-stone-400 md:col-span-2 lg:col-span-1">
                  {t('lobby.roomName')}
                  <input
                    className="field-input"
                    value={view.settings.roomName}
                    onChange={(e) => patchSettings({ roomName: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-400">
                  {t('lobby.mode')}
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
                    <option value="AUTOMATED">{t('lobby.modeAutomated')}</option>
                    <option value="ASSISTED">{t('lobby.modeAssisted')}</option>
                  </select>
                </label>
                {view.settings.moderatorMode === 'ASSISTED' && (
                  <label className="flex flex-col gap-1 text-xs text-stone-400">
                    {t('lobby.masterLabel')}
                    <select
                      className="field-input"
                      value={
                        view.players.find((p) => p.isMaster)?.id ??
                        session.playerId
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
                  {t('lobby.haptics')}
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
                    <option value="NONE">{t('lobby.hapticsNone')}</option>
                    <option value="UNIVERSAL_HEARTBEAT">
                      {t('lobby.hapticsHeartbeat')}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-400">
                  {t('lobby.voteVisibility')}
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
                    <option value="SECRET">{t('lobby.voteSecret')}</option>
                    <option value="PUBLIC">{t('lobby.votePublic')}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-400">
                  {t('lobby.tieBreak')}
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
                    <option value="NO_ELIMINATION">{t('lobby.tieNoBurn')}</option>
                    <option value="RUNOFF">{t('lobby.tieRunoff')}</option>
                  </select>
                </label>
                <label className="flex min-h-[var(--touch-min)] items-center justify-between gap-3 fluid-body text-stone-300">
                  <span>{t('lobby.ambientAudio')}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={view.settings.ambientAudioEnabled}
                    onChange={(e) =>
                      patchSettings({ ambientAudioEnabled: e.target.checked })
                    }
                  />
                </label>
                <label className="flex min-h-[var(--touch-min)] items-center justify-between gap-3 fluid-body text-stone-300">
                  <span>{t('lobby.allowLateJoin')}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={view.settings.allowLateJoin}
                    onChange={(e) =>
                      patchSettings({ allowLateJoin: e.target.checked })
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ['discussionDurationMs', 'lobby.discussionSec'],
                    ['tribunalDurationMs', 'lobby.tribunalSec'],
                    ['defaultNightTurnDurationMs', 'lobby.nightTurnSec'],
                    ['dawnDurationMs', 'lobby.dawnSec'],
                    ['ballotRevealDurationMs', 'lobby.ballotSec'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label
                    key={key}
                    className="flex flex-col gap-1 text-xs text-stone-400"
                  >
                    {t(labelKey)}
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      className="field-input"
                      value={msToSec(
                        view.settings[key] ?? DEFAULT_ROOM_SETTINGS[key],
                      )}
                      onChange={(e) =>
                        patchSettings({
                          [key]:
                            Math.max(5, Number(e.target.value) || 5) * 1000,
                        })
                      }
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1 text-xs text-stone-400">
                  {t('lobby.assistedMult')}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    className="field-input"
                    value={view.settings.assistedTimerMultiplier ?? 2}
                    onChange={(e) =>
                      patchSettings({
                        assistedTimerMultiplier: Math.max(
                          1,
                          Number(e.target.value) || 2,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={exportPreset}
                  className="btn-ghost w-full flex-1"
                >
                  <Download className="h-4 w-4" /> {t('lobby.export')}
                </button>
                <label className="btn-ghost w-full flex-1 cursor-pointer">
                  <Upload className="h-4 w-4" /> {t('lobby.import')}
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
          </div>
        )}

        {isHost && draftDeck && (
          <div className="desktop-split__full">
            <RoleScheduleEditor deck={draftDeck} onChange={saveDeck} />
          </div>
        )}

        {isHost && (
          <div className="desktop-split__full">
            <button
              type="button"
              className="btn-primary max-w-md lg:max-w-sm"
              onClick={() =>
                getSocket().emit('game:start', {}, (res) => {
                  if (!res?.ok) {
                    setToast({
                      level: 'error',
                      message: res?.error ?? t('lobby.startFailed'),
                    });
                  }
                })
              }
            >
              {t('lobby.dealRoles')}
            </button>
          </div>
        )}
      </div>

      {!isHost && (
        <p className="text-center fluid-body text-stone-500">
          {t('lobby.waitingHost')}
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
        {t('lobby.leave')}
      </button>
    </div>
  );
}
