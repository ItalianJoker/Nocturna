/**
 * @fileoverview Day phases — mobile-first dawn / discussion / tribunal / end.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SanitizedGameState } from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { formatMs, useServerCountdown } from '../hooks/useServerCountdown';
import {
  selectIsMasterView,
  useAppStore,
} from '../store/appStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MasterDashboard } from './MasterDashboard';

interface DayFlowProps {
  view: SanitizedGameState;
}

export function DayFlow({ view }: DayFlowProps) {
  const storeView = useAppStore((s) => s.view);
  if (storeView && selectIsMasterView(storeView)) {
    return <MasterDashboard view={storeView} />;
  }

  if (view.phase === 'DAWN') return <DawnView view={view} />;
  if (view.phase === 'DISCUSSION') return <DiscussionView view={view} />;
  if (view.phase === 'TRIBUNAL' || view.phase === 'BALLOT') {
    return <TribunalView view={view} />;
  }
  if (view.phase === 'ENDED') return <EndedView view={view} />;
  return null;
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="page-shell">
      <div className="flex items-start justify-between gap-2">
        <p className="fluid-label text-[var(--nocturna-amber)]">{t('day.brand')}</p>
        <LanguageSwitcher />
      </div>
      <h1 className="font-display fluid-title mt-2">{title}</h1>
      {subtitle && (
        <p className="mt-2 fluid-body text-stone-400">{subtitle}</p>
      )}
      <div className="mt-6 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function DawnView({ view }: { view: SanitizedGameState }) {
  const { t } = useTranslation();
  const remaining = useServerCountdown(view.phaseEndsAt, view.serverNow);
  const victims = view.dawnAnnouncement?.victimNames ?? [];
  const saved = view.dawnAnnouncement?.savedNames ?? [];
  return (
    <Shell
      title={t('day.dawnTitle')}
      subtitle={t('day.dawnSubtitle', { time: formatMs(remaining) })}
    >
      <div className="animate-rise rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5">
        {victims.length === 0 ? (
          <p className="text-lg text-stone-300">{t('day.noVictims')}</p>
        ) : (
          <ul className="space-y-2">
            {victims.map((n) => (
              <li
                key={n}
                className="font-display fluid-title text-[var(--nocturna-crimson-hot)] break-words"
              >
                {n}
              </li>
            ))}
          </ul>
        )}
        {saved.length > 0 && (
          <p className="mt-4 fluid-body text-stone-500 break-words">
            {t('day.protectionOn', { names: saved.join(', ') })}
          </p>
        )}
        {view.you.lastInspectResult && (
          <p className="mt-6 rounded-xl border border-white/10 bg-black/50 p-3 fluid-body text-stone-300">
            {t('day.privateVision', {
              target: view.you.lastInspectResult.targetName,
              revealed: view.you.lastInspectResult.revealed,
            })}
          </p>
        )}
      </div>
    </Shell>
  );
}

function DiscussionView({ view }: { view: SanitizedGameState }) {
  const { t } = useTranslation();
  const remaining = useServerCountdown(view.phaseEndsAt, view.serverNow);
  return (
    <Shell
      title={t('day.discussionTitle')}
      subtitle={t('day.discussionSubtitle', { time: formatMs(remaining) })}
    >
      <ul className="scroll-stack space-y-2">
        {view.players
          .filter((p) => !p.isMaster)
          .map((p) => (
            <li
              key={p.id}
              className={`min-h-[var(--touch-min)] rounded-xl border border-white/10 px-4 py-3 fluid-body ${
                p.isAlive
                  ? 'bg-black/30'
                  : 'bg-black/10 text-stone-600 line-through'
              }`}
            >
              <span className="break-words">{p.displayName}</span>
            </li>
          ))}
      </ul>
    </Shell>
  );
}

function TribunalView({ view }: { view: SanitizedGameState }) {
  const { t } = useTranslation();
  const remaining = useServerCountdown(view.phaseEndsAt, view.serverNow);
  const me = view.players.find((p) => p.id === view.you.playerId);
  const canVote = me?.isAlive && !me.isMaster;
  const runoff = view.tribunal?.runoffOf;

  const candidates = view.players.filter((p) => {
    if (!p.isAlive || p.isMaster) return false;
    if (runoff) return runoff.includes(p.id);
    return p.id !== view.you.playerId;
  });

  return (
    <Shell
      title={t('day.tribunalTitle')}
      subtitle={
        view.phase === 'BALLOT'
          ? t('day.tribunalTally')
          : t('day.tribunalVoting', { time: formatMs(remaining) })
      }
    >
      {runoff && (
        <p className="mb-4 fluid-body text-[var(--nocturna-amber)]">
          {t('day.runoff')}
        </p>
      )}
      <ul className="space-y-2">
        {candidates.map((p) => {
          const selected = view.tribunal?.myVote === p.id;
          const tally = view.tribunal?.tallies?.[p.id];
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!canVote || view.phase === 'BALLOT'}
                onClick={() =>
                  getSocket().emit('tribunal:vote', {
                    targetPlayerId: p.id,
                  })
                }
                className={`touch-target flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left fluid-body ${
                  selected
                    ? 'border-[var(--nocturna-crimson)] bg-[var(--nocturna-crimson)]/20'
                    : 'border-white/10 bg-black/30'
                }`}
              >
                <span className="truncate pr-2">{p.displayName}</span>
                {typeof tally === 'number' && (
                  <span className="shrink-0 text-xs text-stone-500">{tally}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {canVote && view.phase === 'TRIBUNAL' && (
        <button
          type="button"
          className="btn-ghost mt-4 w-full"
          onClick={() =>
            getSocket().emit('tribunal:vote', { targetPlayerId: 'ABSTAIN' })
          }
        >
          {t('day.abstain')}
        </button>
      )}
    </Shell>
  );
}

function EndedView({ view }: { view: SanitizedGameState }) {
  const { t } = useTranslation();
  const isHost = view.players.some(
    (p) => p.id === view.you.playerId && p.isHost,
  );
  return (
    <Shell
      title={t('day.endedTitle')}
      subtitle={view.ending?.summary ?? t('day.endedFallback')}
    >
      <ul className="scroll-stack space-y-2">
        {view.ending?.reveal.map((r) => (
          <li
            key={r.playerId}
            className="flex min-h-[var(--touch-min)] items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 fluid-body"
          >
            <span className="min-w-0">
              <span className="block truncate">{r.displayName}</span>
              <span className="mt-0.5 block truncate text-xs text-stone-500">
                {r.roleName} ·{' '}
                {t(`factions.${r.faction}`, { defaultValue: r.faction })}
              </span>
            </span>
            <span
              className={`shrink-0 ${
                r.survived ? 'text-emerald-500' : 'text-stone-600'
              }`}
            >
              {r.survived ? t('day.alive') : t('day.dead')}
            </span>
          </li>
        ))}
      </ul>
      {isHost && (
        <button
          type="button"
          className="btn-primary mt-6"
          onClick={() => getSocket().emit('game:rematch', {})}
        >
          {t('day.rematch')}
        </button>
      )}
    </Shell>
  );
}
