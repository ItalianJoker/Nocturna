/**
 * Lobby guide: explains each role in the current deck (name, faction, description)
 * and makes it obvious Hosts can edit descriptions before dealing.
 */

import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoleDefinition } from '@nocturna/shared';

interface RolesDeckGuideProps {
  deck: RoleDefinition[];
  onChange?: (deck: RoleDefinition[]) => void;
  /** When false, read-only (non-Host / spectators). */
  editable?: boolean;
}

export function RolesDeckGuide({
  deck,
  onChange,
  editable = false,
}: RolesDeckGuideProps) {
  const { t } = useTranslation();
  const visible = deck.filter((r) => r.count > 0);
  const list = visible.length > 0 ? visible : deck;

  const patch = (id: string, patchFields: Partial<Pick<RoleDefinition, 'name' | 'description'>>) => {
    if (!onChange) return;
    onChange(
      deck.map((r) => (r.id === id ? { ...r, ...patchFields } : r)),
    );
  };

  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
      <header className="mb-2 flex items-center gap-2">
        <BookOpen className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]" aria-hidden />
        <h2 className="font-display fluid-h2 text-[var(--nocturna-paper)]">
          {t('roles.guideTitle')}
        </h2>
      </header>
      <p className="mb-1 fluid-body text-[var(--nocturna-mist)]">
        {t('roles.guideHelp')}
      </p>
      {editable && (
        <p className="mb-4 rounded-lg border border-[var(--nocturna-amber)]/25 bg-[var(--nocturna-amber)]/10 px-3 py-2 text-xs leading-snug text-[var(--nocturna-amber)]">
          {t('roles.guideEditableHint')}
        </p>
      )}
      {!editable && <div className="mb-4" />}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((role) => {
          const faction = t(`factions.${role.faction}`, {
            defaultValue: role.faction,
          });
          const nameId = `role-name-${role.id}`;
          const descId = `role-desc-${role.id}`;
          return (
            <li
              key={role.id}
              className="rounded-xl border border-white/5 bg-black/30 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                {editable ? (
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{t('roles.roleName')}</span>
                    <input
                      id={nameId}
                      className="field-input font-medium"
                      style={{ color: role.colorHex }}
                      value={role.name}
                      disabled={!editable}
                      onChange={(e) => patch(role.id, { name: e.target.value })}
                      aria-describedby={`${descId}-hint`}
                    />
                  </label>
                ) : (
                  <p
                    className="truncate font-medium"
                    style={{ color: role.colorHex }}
                  >
                    {role.name}
                  </p>
                )}
                <span className="shrink-0 text-xs text-stone-500">
                  ×{role.count} · {faction}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-stone-600">
                {faction}
              </p>
              {editable ? (
                <label className="mt-2 flex flex-col gap-1">
                  <span className="text-xs text-stone-400">
                    {t('roles.roleDescription')}
                  </span>
                  <textarea
                    id={descId}
                    className="field-input min-h-[5.5rem] resize-y text-sm leading-snug"
                    value={role.description}
                    onChange={(e) =>
                      patch(role.id, { description: e.target.value })
                    }
                    rows={3}
                  />
                  <span id={`${descId}-hint`} className="text-[0.7rem] text-stone-500">
                    {t('roles.roleDescriptionHint')}
                  </span>
                </label>
              ) : (
                <p className="mt-2 fluid-body text-stone-300">{role.description}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
