/**
 * Tap-to-open help — mobile-first (no hover-only tooltips).
 */

import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FieldHelpProps {
  /** Optional stable id; auto-generated when omitted. */
  id?: string;
  children: string;
  /** Compact label next to the ? control. */
  label?: string;
}

export function FieldHelp({ id, children, label }: FieldHelpProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const panelId = id ?? autoId;
  const [open, setOpen] = useState(false);

  if (!children) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        className="touch-target inline-flex min-h-[var(--touch-min)] items-center gap-1.5 rounded-lg px-1 text-left text-[0.75rem] font-medium text-[var(--nocturna-amber)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
        <span>{label ?? (open ? t('help.hide') : t('help.show'))}</span>
      </button>
      {open ? (
        <p
          id={panelId}
          role="note"
          className="mt-1.5 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm leading-snug text-stone-300"
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}
