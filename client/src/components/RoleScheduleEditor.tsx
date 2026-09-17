/**
 * @fileoverview Host panel to reorder night call sequence and edit frequencies.
 *
 * Edits operate on a local draft deck; persistence goes through
 * `lobby:updateDeck` so the server remains authoritative.
 */

import {
  ArrowDown,
  ArrowUp,
  Moon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  RoleDefinition,
  WakeFrequency,
  ActionType,
} from '@nocturna/shared';

const FREQUENCIES: WakeFrequency[] = [
  'EVERY_NIGHT',
  'FIRST_NIGHT_ONLY',
  'ODD_NIGHTS',
  'EVEN_NIGHTS',
  'ON_TRIGGER',
];

const ACTIONS: ActionType[] = [
  'NONE',
  'SINGLE_TARGET',
  'FACTION_VOTE',
  'INSPECT_TARGET',
  'PASSIVE_INFO',
];

interface RoleScheduleEditorProps {
  deck: RoleDefinition[];
  onChange: (deck: RoleDefinition[]) => void;
  disabled?: boolean;
}

export function RoleScheduleEditor({
  deck,
  onChange,
  disabled,
}: RoleScheduleEditorProps) {
  const { t } = useTranslation();
  const sorted = [...deck].sort(
    (a, b) => a.wakeSchedule.priority - b.wakeSchedule.priority,
  );

  const update = (id: string, patch: Partial<RoleDefinition['wakeSchedule']> & { count?: number }) => {
    onChange(
      deck.map((r) => {
        if (r.id !== id) return r;
        const { count, ...wake } = patch;
        return {
          ...r,
          count: count ?? r.count,
          wakeSchedule: { ...r.wakeSchedule, ...wake },
        };
      }),
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    const order = sorted.map((r) => r.id);
    const idx = order.indexOf(id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= order.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    onChange(
      deck.map((r) => {
        if (r.id === a.id) {
          return {
            ...r,
            wakeSchedule: { ...r.wakeSchedule, priority: b.wakeSchedule.priority },
          };
        }
        if (r.id === b.id) {
          return {
            ...r,
            wakeSchedule: { ...r.wakeSchedule, priority: a.wakeSchedule.priority },
          };
        }
        return r;
      }),
    );
  };

  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
      <header className="mb-3 flex items-center gap-2">
        <Moon className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]" />
        <h2 className="font-display fluid-h2 text-[var(--nocturna-paper)]">
          {t('roles.editorTitle')}
        </h2>
      </header>
      <p className="mb-4 fluid-body text-[var(--nocturna-mist)]">
        {t('roles.editorHelp')}
      </p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sorted.map((role) => (
          <li
            key={role.id}
            className="rounded-xl border border-white/5 bg-black/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate font-medium"
                  style={{ color: role.colorHex }}
                >
                  {role.name}
                </p>
                <p className="text-xs text-stone-500">
                  {t(`factions.${role.faction}`, { defaultValue: role.faction })} ·{' '}
                  {role.wakeSchedule.priority}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  className="touch-target rounded-lg border border-white/10 p-2 text-stone-400"
                  onClick={() => move(role.id, -1)}
                  aria-label={t('roles.raisePriority')}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="touch-target rounded-lg border border-white/10 p-2 text-stone-400"
                  onClick={() => move(role.id, 1)}
                  aria-label={t('roles.lowerPriority')}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs min-[380px]:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1 text-stone-400">
                {t('roles.frequency')}
                <select
                  disabled={disabled}
                  className="field-input"
                  value={role.wakeSchedule.frequency}
                  onChange={(e) =>
                    update(role.id, {
                      frequency: e.target.value as WakeFrequency,
                    })
                  }
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-stone-400">
                {t('roles.action')}
                <select
                  disabled={disabled}
                  className="field-input"
                  value={role.wakeSchedule.actionType}
                  onChange={(e) =>
                    update(role.id, {
                      actionType: e.target.value as ActionType,
                    })
                  }
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-stone-400">
                {t('roles.copies')}
                <input
                  type="number"
                  min={0}
                  max={20}
                  disabled={disabled}
                  className="field-input"
                  value={role.count}
                  onChange={(e) =>
                    update(role.id, { count: Number(e.target.value) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-stone-400">
                {t('roles.maskingMs')}
                <input
                  type="number"
                  min={0}
                  step={1000}
                  disabled={disabled}
                  className="field-input"
                  value={role.wakeSchedule.timeMaskingDuration}
                  onChange={(e) =>
                    update(role.id, {
                      timeMaskingDuration: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
