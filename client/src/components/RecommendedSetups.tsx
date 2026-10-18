/**
 * Host-only “Partite consigliate” — one-tap decks by player count.
 */

import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  RECOMMENDED_SETUPS,
  deckFromRecommended,
  pickRecommendedForPlayerCount,
  type RoleDefinition,
  type RecommendedSetup,
} from '@nocturna/shared';

interface RecommendedSetupsProps {
  playerCount: number;
  onApply: (deck: RoleDefinition[]) => void;
}

function summarizeCounts(
  setup: RecommendedSetup,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  return Object.entries(setup.counts)
    .filter(([, n]) => n > 0)
    .map(
      ([id, n]) =>
        `${n}× ${t(`roles.${id}.name`, { defaultValue: id })}`,
    )
    .join(' · ');
}

export function RecommendedSetups({
  playerCount,
  onApply,
}: RecommendedSetupsProps) {
  const { t } = useTranslation();
  const suggested = useMemo(
    () => pickRecommendedForPlayerCount(playerCount),
    [playerCount],
  );

  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
      <header className="mb-2 flex items-center gap-2">
        <LayoutGrid
          className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]"
          aria-hidden
        />
        <h2 className="font-display fluid-h2 text-[var(--nocturna-paper)]">
          {t('lobby.recommendedTitle')}
        </h2>
      </header>
      <p className="mb-3 fluid-body text-[var(--nocturna-mist)]">
        {t('lobby.recommendedHelp', { count: playerCount })}
      </p>

      <div className="mb-3 rounded-xl border border-[var(--nocturna-amber)]/30 bg-[var(--nocturna-amber)]/10 p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--nocturna-amber)]">
          {t('lobby.recommendedSuggested')}
        </p>
        <p className="mt-1 font-medium text-[var(--nocturna-paper)]">
          {t(`lobby.recommended.${suggested.id}.title`, {
            defaultValue: t('lobby.recommendedGeneric', {
              min: suggested.minPlayers,
              max: suggested.maxPlayers,
            }),
          })}
        </p>
        <p className="mt-1 text-xs leading-snug text-stone-400">
          {summarizeCounts(suggested, t)}
        </p>
        <button
          type="button"
          className="btn-primary mt-3 w-full sm:w-auto"
          onClick={() => onApply(deckFromRecommended(suggested))}
        >
          {t('lobby.recommendedApply')}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RECOMMENDED_SETUPS.map((setup) => {
          const active = setup.id === suggested.id;
          return (
            <li key={setup.id}>
              <button
                type="button"
                className={`touch-target w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? 'border-[var(--nocturna-amber)]/40 bg-black/40'
                    : 'border-white/10 bg-black/20 hover:border-white/20'
                }`}
                onClick={() => onApply(deckFromRecommended(setup))}
              >
                <p className="font-medium text-[var(--nocturna-paper)]">
                  {t(`lobby.recommended.${setup.id}.title`, {
                    defaultValue: t('lobby.recommendedGeneric', {
                      min: setup.minPlayers,
                      max: setup.maxPlayers,
                    }),
                  })}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {t('lobby.recommendedPlayers', {
                    min: setup.minPlayers,
                    max: setup.maxPlayers,
                  })}
                </p>
                <p className="mt-1 text-xs leading-snug text-stone-400">
                  {t(`lobby.recommended.${setup.id}.blurb`, {
                    defaultValue: summarizeCounts(setup, t),
                  })}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
