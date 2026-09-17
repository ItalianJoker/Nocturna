/**
 * @fileoverview Assisted-mode Master God-View — phone stack, lg+ two-column.
 */

import {
  FastForward,
  Pause,
  Play,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MasterGameState } from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { formatMs, useServerCountdown } from '../hooks/useServerCountdown';
import { LanguageSwitcher } from './LanguageSwitcher';

interface MasterDashboardProps {
  view: MasterGameState;
}

export function MasterDashboard({ view }: MasterDashboardProps) {
  const { t } = useTranslation();
  const remaining = useServerCountdown(view.phaseEndsAt, view.serverNow);
  const turn = view.nightQueue[view.currentTurnIndex];

  const emit = {
    advance: () => getSocket().emit('master:forceAdvance', {}),
    pause: (paused: boolean) =>
      getSocket().emit('master:setPaused', { paused }),
    cancel: (actionId: string) =>
      getSocket().emit('master:cancelAction', { actionId }),
    phase: (phase: 'DISCUSSION' | 'TRIBUNAL' | 'NIGHT') =>
      getSocket().emit('master:setPhase', { phase }),
    beginNight: () => getSocket().emit('game:beginNight', {}),
  };

  return (
    <div className="page-shell page-shell--master gap-4">
      <header className="animate-rise shrink-0">
        <div className="flex items-start justify-between gap-2">
          <p className="fluid-label text-[var(--nocturna-crimson-hot)]">
            {t('master.eyebrow')}
          </p>
          <LanguageSwitcher />
        </div>
        <h1 className="font-display fluid-title mt-1 text-[var(--nocturna-paper)]">
          {view.settings.roomName}
        </h1>
        <p className="mt-2 fluid-body text-stone-400">
          {t('master.phase', { phase: t(`phases.${view.phase}`) })}
          {view.phaseEndsAt ? ` · ${formatMs(remaining)}` : ''}
          {view.isPaused ? ` · ${t('master.paused')}` : ''}
        </p>
      </header>

      <div className="desktop-split scroll-stack pb-2">
        <section className="desktop-split__main rounded-2xl border border-white/10 bg-[var(--nocturna-panel)] p-3 sm:p-4 lg:p-5">
          <h2 className="font-display fluid-h2">{t('master.roster')}</h2>
          <ul className="list-pane mt-3 divide-y divide-white/5">
            {view.masterRoster.map((p) => (
              <li
                key={p.id}
                className="flex min-h-[var(--touch-min)] items-center justify-between gap-2 py-2 fluid-body"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate ${
                      p.isAlive ? 'text-stone-100' : 'text-stone-500 line-through'
                    }`}
                  >
                    {p.displayName}
                    {p.isMaster ? ` · ${t('lobby.master')}` : ''}
                    {!p.isConnected ? ` · ${t('master.offline')}` : ''}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {p.roleName ?? '—'} ·{' '}
                    {p.faction
                      ? t(`factions.${p.faction}`, { defaultValue: p.faction })
                      : '—'}
                    {p.isProtected ? ` · ${t('master.protected')}` : ''}
                  </p>
                </div>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    p.isAlive ? 'bg-emerald-600' : 'bg-stone-700'
                  }`}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="desktop-split__side space-y-4">
          {view.phase === 'ROLE_REVEAL' && (
            <button type="button" onClick={emit.beginNight} className="btn-primary">
              {t('master.beginNight')}
            </button>
          )}

          {view.phase === 'NIGHT' && (
            <section className="rounded-2xl border border-[var(--nocturna-crimson)]/30 bg-black/40 p-3 sm:p-4 lg:p-5">
              <h2 className="font-display fluid-h2">{t('master.stepper')}</h2>
              <ol className="list-pane mt-3 space-y-2 fluid-body">
                {view.nightQueue.map((nightTurn, i) => (
                  <li
                    key={nightTurn.turnId}
                    className={`rounded-lg border px-3 py-2.5 ${
                      i === view.currentTurnIndex
                        ? 'border-[var(--nocturna-amber)]/50 bg-[var(--nocturna-amber)]/10'
                        : i < view.currentTurnIndex
                          ? 'border-white/5 text-stone-600'
                          : 'border-white/10'
                    }`}
                  >
                    <p className="font-medium">
                      {i + 1}. {t('master.call', { role: nightTurn.roleName })}
                    </p>
                    <p className="text-xs text-stone-500 break-words">
                      {nightTurn.actionType} ·{' '}
                      {nightTurn.actorPlayerIds
                        .map(
                          (id) =>
                            view.masterRoster.find((p) => p.id === id)
                              ?.displayName ?? id,
                        )
                        .join(', ') || '—'}
                    </p>
                    {i === view.currentTurnIndex && turn && (
                      <p className="mt-1 text-xs text-[var(--nocturna-amber)]">
                        {t('master.inProgress', {
                          done: view.pendingActions.filter(
                            (a) =>
                              !a.isNullAction && a.actorRoleId === turn.roleId,
                          ).length,
                          total: turn.actorPlayerIds.length,
                        })}
                      </p>
                    )}
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={emit.advance}
                  className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--nocturna-crimson)] px-4 py-3 text-sm text-white sm:w-auto"
                >
                  <FastForward className="h-4 w-4 shrink-0" />{' '}
                  {t('master.forceAdvance')}
                </button>
                <button
                  type="button"
                  onClick={() => emit.pause(!view.isPaused)}
                  className="btn-ghost w-full sm:w-auto"
                >
                  {view.isPaused ? (
                    <>
                      <Play className="h-4 w-4" /> {t('master.resume')}
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4" /> {t('master.pause')}
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {view.pendingActions.length > 0 && view.phase === 'NIGHT' && (
            <section className="rounded-2xl border border-white/10 p-3 sm:p-4 lg:p-5">
              <h2 className="font-display fluid-h2">{t('master.pending')}</h2>
              <ul className="mt-2 space-y-2 fluid-body">
                {view.pendingActions.map((a) => (
                  <li
                    key={a.id}
                    className="flex min-h-[var(--touch-min)] items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-stone-300">
                      {a.actorRoleId} → {a.targetPlayerId ?? '—'}
                      {a.isNullAction ? ' (null)' : ''}
                    </span>
                    <button
                      type="button"
                      className="touch-target shrink-0 rounded-lg border border-white/10 p-2 text-stone-400"
                      onClick={() => emit.cancel(a.id)}
                      aria-label={t('master.cancelAction')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(view.phase === 'DISCUSSION' ||
            view.phase === 'DAWN' ||
            view.phase === 'TRIBUNAL') && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {view.phase === 'DAWN' && (
                <button
                  type="button"
                  onClick={emit.advance}
                  className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--nocturna-crimson)] px-4 py-3 text-sm text-white sm:w-auto"
                >
                  <SkipForward className="h-4 w-4" /> {t('master.toDiscussion')}
                </button>
              )}
              {view.phase === 'DISCUSSION' && (
                <button
                  type="button"
                  onClick={() => emit.phase('TRIBUNAL')}
                  className="btn-primary sm:w-auto"
                >
                  {t('master.openTribunal')}
                </button>
              )}
              {view.phase === 'TRIBUNAL' && (
                <button
                  type="button"
                  onClick={emit.advance}
                  className="btn-primary sm:w-auto"
                >
                  {t('master.closeVote')}
                </button>
              )}
              <button
                type="button"
                onClick={() => emit.pause(!view.isPaused)}
                className="btn-ghost w-full sm:w-auto"
              >
                {view.isPaused ? t('master.resume') : t('master.pause')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
