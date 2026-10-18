/**
 * In-lobby Regolamento — visible to Host and players.
 * Original Nocturna rules copy only (no commercial game text).
 */

import { useState } from 'react';
import { ScrollText, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SECTIONS = [
  'goal',
  'phases',
  'night',
  'day',
  'modes',
  'stealth',
] as const;

export function LobbyRules() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('phases');

  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
      <button
        type="button"
        className="touch-target flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ScrollText
            className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]"
            aria-hidden
          />
          <span className="font-display fluid-h2 text-[var(--nocturna-paper)]">
            {t('rules.title')}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-stone-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      <p className="mt-1 fluid-body text-[var(--nocturna-mist)]">
        {t('rules.blurb')}
      </p>

      {open ? (
        <div className="mt-3 space-y-2">
          {SECTIONS.map((key) => {
            const isOpen = expanded === key;
            const panelId = `rules-panel-${key}`;
            return (
              <div
                key={key}
                className="overflow-hidden rounded-xl border border-white/5 bg-black/30"
              >
                <button
                  type="button"
                  className="touch-target flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  <span className="font-medium text-[var(--nocturna-paper)]">
                    {t(`rules.${key}.title`)}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-stone-500 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <div
                    id={panelId}
                    className="border-t border-white/5 px-3 pb-3 pt-2 text-sm leading-relaxed text-stone-300 whitespace-pre-line"
                  >
                    {t(`rules.${key}.body`)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
