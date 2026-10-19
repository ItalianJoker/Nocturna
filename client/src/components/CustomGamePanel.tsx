/**
 * Host “Partita Personalizzata” — manual deck composition, add missing catalog
 * roles, and create custom RoleDefinitions before kickoff.
 */

import { useMemo, useState } from 'react';
import { Minus, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_ROLE_DECK,
  ROLE_ENUMS,
  deckSeatTotal,
  type ActionType,
  type Faction,
  type ResolutionBand,
  type RoleDefinition,
  type WakeFrequency,
  type WinCondition,
} from '@nocturna/shared';
import { FieldHelp } from './FieldHelp';

interface CustomGamePanelProps {
  deck: RoleDefinition[];
  playerCount: number;
  onChange: (deck: RoleDefinition[]) => void;
  disabled?: boolean;
}

const DEFAULT_COLORS = [
  '#C4B5A0',
  '#3D8B7A',
  '#6B8E9F',
  '#8B6B7A',
  '#A67C52',
  '#7A8B6B',
  '#9F6B6B',
  '#6B7A9F',
];

function slugifyRoleId(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const stem = base && /^[a-z]/.test(base) ? base : `custom_${base || 'role'}`;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stem}_${suffix}`.slice(0, 64);
}

function inferBandAndFlags(actionType: ActionType): {
  resolutionBand?: ResolutionBand;
  grantsProtection?: boolean;
  isLethal?: boolean;
  inspectReveals?: 'FACTION' | 'ROLE';
} {
  switch (actionType) {
    case 'FACTION_VOTE':
      return { resolutionBand: 'ATTACK', isLethal: true };
    case 'INSPECT_TARGET':
      return { resolutionBand: 'INVESTIGATION', inspectReveals: 'FACTION' };
    case 'SINGLE_TARGET':
      return { resolutionBand: 'PROTECTION', grantsProtection: true };
    default:
      return {};
  }
}

function catalogLabel(
  id: string,
  fallbackName: string,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  return t(`roles.${id}.name`, { defaultValue: fallbackName });
}

export function CustomGamePanel({
  deck,
  playerCount,
  onChange,
  disabled,
}: CustomGamePanelProps) {
  const { t } = useTranslation();
  const seatTotal = deckSeatTotal(deck);
  const match =
    playerCount > 0 && seatTotal === playerCount
      ? 'ok'
      : seatTotal < playerCount
        ? 'short'
        : 'over';

  const missingCatalog = useMemo(() => {
    const present = new Set(deck.map((r) => r.id));
    return DEFAULT_ROLE_DECK.filter((r) => !present.has(r.id));
  }, [deck]);

  const [addRoleId, setAddRoleId] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFaction, setCustomFaction] = useState<Faction>('VILLAGE');
  const [customDesc, setCustomDesc] = useState('');
  const [customFreq, setCustomFreq] = useState<WakeFrequency>('EVERY_NIGHT');
  const [customAction, setCustomAction] = useState<ActionType>('NONE');
  const [customWin, setCustomWin] = useState<WinCondition>(
    'ELIMINATE_ALL_IMPOSTORS',
  );
  const [customPriority, setCustomPriority] = useState(50);
  const [customCount, setCustomCount] = useState(1);
  const [customIcon, setCustomIcon] = useState('Sparkles');
  const [creatorError, setCreatorError] = useState<string | null>(null);

  const setCount = (id: string, count: number) => {
    onChange(
      deck.map((r) =>
        r.id === id
          ? { ...r, count: Math.max(0, Math.min(20, Math.floor(count))) }
          : r,
      ),
    );
  };

  const removeRole = (id: string) => {
    onChange(deck.filter((r) => r.id !== id));
  };

  const addCatalogRole = () => {
    if (!addRoleId) return;
    const template = DEFAULT_ROLE_DECK.find((r) => r.id === addRoleId);
    if (!template) return;
    if (deck.some((r) => r.id === addRoleId)) return;
    const localizedName = catalogLabel(template.id, template.name, t);
    const localizedDesc = t(`roles.${template.id}.description`, {
      defaultValue: template.description,
    });
    onChange([
      ...deck,
      {
        ...template,
        name: localizedName,
        description: localizedDesc,
        count: Math.max(1, template.count || 1),
        wakeSchedule: { ...template.wakeSchedule },
      },
    ]);
    setAddRoleId('');
  };

  const createCustomRole = () => {
    setCreatorError(null);
    const name = customName.trim();
    if (!name) {
      setCreatorError(t('lobby.customRoleNameRequired'));
      return;
    }
    const id = slugifyRoleId(name);
    if (deck.some((r) => r.id === id)) {
      setCreatorError(t('lobby.customRoleIdClash'));
      return;
    }
    const flags = inferBandAndFlags(customAction);
    const colorHex =
      DEFAULT_COLORS[deck.length % DEFAULT_COLORS.length] ?? '#C4B5A0';
    const role: RoleDefinition = {
      id,
      name: name.slice(0, 48),
      faction: customFaction,
      description: customDesc.trim().slice(0, 500),
      colorHex,
      iconName: ROLE_ENUMS.iconNames.includes(customIcon)
        ? customIcon
        : 'Sparkles',
      winCondition: customWin,
      count: Math.max(1, Math.min(20, customCount)),
      wakeSchedule: {
        frequency: customFreq,
        priority: Math.max(0, Math.min(999, customPriority)),
        actionType: customAction,
        timeMaskingDuration:
          customAction === 'NONE' || customAction === 'PASSIVE_INFO'
            ? 0
            : 20_000,
        ...(flags.resolutionBand
          ? { resolutionBand: flags.resolutionBand }
          : {}),
        ...(customAction === 'PASSIVE_INFO'
          ? { passiveInfoText: customDesc.trim().slice(0, 200) || name }
          : {}),
      },
      ...(flags.grantsProtection ? { grantsProtection: true } : {}),
      ...(flags.isLethal ? { isLethal: true } : {}),
      ...(flags.inspectReveals ? { inspectReveals: flags.inspectReveals } : {}),
    };
    onChange([...deck, role]);
    setCustomName('');
    setCustomDesc('');
    setCustomCount(1);
    setCustomPriority(50);
    setCustomAction('NONE');
    setCustomFreq('EVERY_NIGHT');
    setCustomFaction('VILLAGE');
    setCustomWin('ELIMINATE_ALL_IMPOSTORS');
    setShowCreator(false);
  };

  const matchClass =
    match === 'ok'
      ? 'border-[var(--nocturna-amber)]/40 bg-[var(--nocturna-amber)]/10 text-[var(--nocturna-amber)]'
      : match === 'short'
        ? 'border-amber-700/40 bg-amber-950/30 text-amber-200'
        : 'border-rose-700/40 bg-rose-950/30 text-rose-200';

  return (
    <section className="animate-rise rounded-2xl border border-white/10 bg-[var(--nocturna-panel)]/80 p-3 sm:p-4">
      <header className="mb-2 flex items-center gap-2">
        <Wand2
          className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]"
          aria-hidden
        />
        <h2 className="font-display fluid-h2 text-[var(--nocturna-paper)]">
          {t('lobby.customGameTitle')}
        </h2>
      </header>
      <p className="mb-3 fluid-body text-[var(--nocturna-mist)]">
        {t('lobby.customGameHelp')}
      </p>

      <div
        className={`mb-4 rounded-xl border px-3 py-3 text-sm ${matchClass}`}
        role="status"
      >
        <p className="font-medium">
          {t('lobby.customComposition', {
            seats: seatTotal,
            players: playerCount,
          })}
        </p>
        <p className="mt-1 text-xs leading-snug opacity-90">
          {match === 'ok'
            ? t('lobby.customCompositionOk')
            : match === 'short'
              ? t('lobby.customCompositionShort')
              : t('lobby.customCompositionOver')}
        </p>
        <FieldHelp id="help-custom-composition" label={t('help.aboutOption')}>
          {t('lobby.customCompositionHelp')}
        </FieldHelp>
      </div>

      <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {deck.map((role) => {
          const displayName = catalogLabel(role.id, role.name, t);
          const faction = t(`factions.${role.faction}`, {
            defaultValue: role.faction,
          });
          const isCustom = !DEFAULT_ROLE_DECK.some((c) => c.id === role.id);
          return (
            <li
              key={role.id}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-medium"
                  style={{ color: role.colorHex }}
                >
                  {displayName}
                  {isCustom ? (
                    <span className="ml-1 text-[0.65rem] uppercase tracking-wide text-stone-500">
                      {t('lobby.customBadge')}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-stone-500">{faction}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || role.count <= 0}
                  className="touch-target rounded-lg border border-white/10 p-2 text-stone-300"
                  aria-label={t('lobby.customDecrease')}
                  onClick={() => setCount(role.id, role.count - 1)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="min-w-[2ch] text-center font-medium text-[var(--nocturna-paper)]"
                  aria-live="polite"
                >
                  {role.count}
                </span>
                <button
                  type="button"
                  disabled={disabled || role.count >= 20}
                  className="touch-target rounded-lg border border-white/10 p-2 text-stone-300"
                  aria-label={t('lobby.customIncrease')}
                  onClick={() => setCount(role.id, role.count + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="touch-target rounded-lg border border-white/10 p-2 text-stone-500"
                  aria-label={t('lobby.customRemove')}
                  title={t('lobby.customRemove')}
                  onClick={() => removeRole(role.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
          {t('lobby.customAddMissingTitle')}
        </p>
        <p className="mb-2 text-xs leading-snug text-stone-500">
          {t('lobby.customAddMissingHelp')}
        </p>
        {missingCatalog.length === 0 ? (
          <p className="text-sm text-stone-500">
            {t('lobby.customAddMissingEmpty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-stone-400">
              {t('lobby.customAddMissingLabel')}
              <select
                disabled={disabled}
                className="field-input"
                value={addRoleId}
                onChange={(e) => setAddRoleId(e.target.value)}
              >
                <option value="">{t('lobby.customAddMissingPlaceholder')}</option>
                {missingCatalog.map((r) => (
                  <option key={r.id} value={r.id}>
                    {catalogLabel(r.id, r.name, t)} ·{' '}
                    {t(`factions.${r.faction}`)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled || !addRoleId}
              className="btn-ghost w-full sm:w-auto"
              onClick={addCatalogRole}
            >
              <Plus className="h-4 w-4" /> {t('lobby.customAddMissingAction')}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setShowCreator((v) => !v)}
          aria-expanded={showCreator}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--nocturna-amber)]" />
          <span className="font-medium text-[var(--nocturna-paper)]">
            {t('lobby.customRoleTitle')}
          </span>
          <span className="ml-auto text-xs text-stone-500">
            {showCreator ? t('lobby.customRoleHide') : t('lobby.customRoleShow')}
          </span>
        </button>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          {t('lobby.customRoleHelp')}
        </p>

        {showCreator && (
          <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-stone-400 min-[380px]:col-span-2">
              {t('lobby.customRoleName')}
              <input
                className="field-input"
                value={customName}
                maxLength={48}
                disabled={disabled}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t('lobby.customRoleNamePlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400 min-[380px]:col-span-2">
              {t('lobby.customRoleDescription')}
              <textarea
                className="field-input min-h-[4.5rem] resize-y text-sm"
                value={customDesc}
                maxLength={500}
                disabled={disabled}
                onChange={(e) => setCustomDesc(e.target.value)}
                rows={3}
                placeholder={t('lobby.customRoleDescriptionPlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('lobby.customRoleFaction')}
              <select
                className="field-input"
                value={customFaction}
                disabled={disabled}
                onChange={(e) => setCustomFaction(e.target.value as Faction)}
              >
                {ROLE_ENUMS.factions.map((f) => (
                  <option key={f} value={f}>
                    {t(`factions.${f}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('lobby.customRoleWin')}
              <select
                className="field-input"
                value={customWin}
                disabled={disabled}
                onChange={(e) =>
                  setCustomWin(e.target.value as WinCondition)
                }
              >
                {ROLE_ENUMS.winConditions.map((w) => (
                  <option key={w} value={w}>
                    {t(`lobby.winConditionLabel.${w}`)}
                  </option>
                ))}
              </select>
              <FieldHelp label={t('help.aboutOption')}>
                {t(`lobby.winConditionHelp.${customWin}`)}
              </FieldHelp>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('roles.frequency')}
              <select
                className="field-input"
                value={customFreq}
                disabled={disabled}
                onChange={(e) =>
                  setCustomFreq(e.target.value as WakeFrequency)
                }
              >
                {ROLE_ENUMS.frequencies.map((f) => (
                  <option key={f} value={f}>
                    {t(`roles.frequencyLabel.${f}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('roles.action')}
              <select
                className="field-input"
                value={customAction}
                disabled={disabled}
                onChange={(e) =>
                  setCustomAction(e.target.value as ActionType)
                }
              >
                {ROLE_ENUMS.actionTypes.map((a) => (
                  <option key={a} value={a}>
                    {t(`roles.actionLabel.${a}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('roles.callOrderHelpLabel')}
              <input
                type="number"
                min={0}
                max={999}
                className="field-input"
                value={customPriority}
                disabled={disabled}
                onChange={(e) =>
                  setCustomPriority(Number(e.target.value) || 0)
                }
              />
              <FieldHelp label={t('help.aboutOption')}>
                {t('lobby.customRolePriorityHelp')}
              </FieldHelp>
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400">
              {t('roles.copies')}
              <input
                type="number"
                min={1}
                max={20}
                className="field-input"
                value={customCount}
                disabled={disabled}
                onChange={(e) =>
                  setCustomCount(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-400 min-[380px]:col-span-2">
              {t('lobby.customRoleIcon')}
              <select
                className="field-input"
                value={customIcon}
                disabled={disabled}
                onChange={(e) => setCustomIcon(e.target.value)}
              >
                {ROLE_ENUMS.iconNames.map((icon) => (
                  <option key={icon} value={icon}>
                    {t(`lobby.iconLabel.${icon}`, { defaultValue: icon })}
                  </option>
                ))}
              </select>
            </label>
            {creatorError ? (
              <p className="text-sm text-rose-300 min-[380px]:col-span-2">
                {creatorError}
              </p>
            ) : null}
            <div className="min-[380px]:col-span-2">
              <button
                type="button"
                disabled={disabled}
                className="btn-primary w-full sm:w-auto"
                onClick={createCustomRole}
              >
                <Plus className="h-4 w-4" /> {t('lobby.customRoleCreate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
