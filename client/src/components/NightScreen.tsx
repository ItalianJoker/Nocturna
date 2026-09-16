/**
 * @fileoverview OLED-black stealth night screen — mobile-first.
 *
 * Active and sleeping views keep equivalent luminance. Layout uses safe-area
 * insets and ≥44px targets so any phone in the circle can act without
 * horizontal scroll or cramped taps.
 */

import { useState } from 'react';
import type { SanitizedGameState } from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { formatMs, useServerCountdown } from '../hooks/useServerCountdown';

interface NightScreenProps {
  view: SanitizedGameState;
}

export function NightScreen({ view }: NightScreenProps) {
  const night = view.night;
  const remaining = useServerCountdown(view.phaseEndsAt, view.serverNow);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAwake = night?.isAwake && night.currentTurn;

  const submit = (targetPlayerId?: string | null, confirm?: boolean) => {
    if (!night?.currentTurn || busy || night.currentTurn.hasSubmitted) return;
    setBusy(true);
    getSocket().emit(
      'night:submitAction',
      {
        turnId: night.currentTurn.turnId,
        targetPlayerId: targetPlayerId ?? undefined,
        confirm,
      },
      () => setBusy(false),
    );
  };

  return (
    <div className="night-stealth flex flex-col">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2 fluid-label text-zinc-700">
        <span>Nocturna</span>
        <span>Notte {view.nightNumber}</span>
        {view.phaseEndsAt ? (
          <span className="tabular-nums">{formatMs(remaining)}</span>
        ) : (
          <span>—</span>
        )}
      </header>

      {!isAwake ? (
        <div className="flex flex-1 flex-col items-center justify-center px-1 text-center">
          <div className="relative mb-8 h-20 w-20 sm:h-24 sm:w-24">
            <div className="animate-pulse-ring absolute inset-0 rounded-full border border-zinc-900" />
            <div className="absolute inset-3 rounded-full border border-zinc-900/80" />
          </div>
          <p className="font-display animate-breathe fluid-title tracking-wide text-zinc-800">
            Il villaggio dorme
          </p>
          <p className="night-active-text mt-4 max-w-[18rem] fluid-body leading-relaxed">
            Occhi chiusi. Nessun segnale. Aspetta il battito comune.
          </p>
        </div>
      ) : (
        <div className="animate-rise flex min-h-0 flex-1 flex-col">
          <p className="fluid-label text-zinc-700">
            Sei sveglio · {night!.currentTurn!.roleName}
          </p>
          <h1 className="font-display night-active-text mt-3 fluid-title leading-tight">
            {night!.currentTurn!.wakePrompt}
          </h1>
          {night!.currentTurn!.passiveInfoText && (
            <p className="mt-4 fluid-body text-zinc-700">
              {night!.currentTurn!.passiveInfoText}
            </p>
          )}

          {night!.currentTurn!.hasSubmitted ? (
            <p className="mt-10 fluid-body text-zinc-700">
              Azione registrata. Attendi la fine del micro-turno…
            </p>
          ) : (
            <>
              {(night!.currentTurn!.actionType === 'SINGLE_TARGET' ||
                night!.currentTurn!.actionType === 'INSPECT_TARGET' ||
                night!.currentTurn!.actionType === 'FACTION_VOTE') && (
                <ul className="mt-6 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto overscroll-contain">
                  {night!.currentTurn!.eligibleTargets.map((t) => {
                    const tally =
                      night!.currentTurn!.factionVoteTally[t.id] ?? 0;
                    const isSelected = selected === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={`night-control touch-target flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left fluid-body transition ${
                            isSelected ? 'selected' : ''
                          }`}
                          onClick={() => setSelected(t.id)}
                        >
                          <span className="truncate pr-2">{t.displayName}</span>
                          {night!.currentTurn!.actionType === 'FACTION_VOTE' &&
                            tally > 0 && (
                              <span className="shrink-0 text-xs text-zinc-600">
                                {tally}
                              </span>
                            )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-auto pt-6">
                {night!.currentTurn!.actionType === 'PASSIVE_INFO' ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="night-control touch-target w-full rounded-lg border py-3 fluid-body"
                    onClick={() => submit(null, true)}
                  >
                    Ho compreso
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!selected || busy}
                    className="night-control touch-target w-full rounded-lg border py-3 fluid-body disabled:opacity-40"
                    onClick={() => submit(selected)}
                  >
                    Conferma
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
