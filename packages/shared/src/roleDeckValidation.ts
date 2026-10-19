/**
 * @fileoverview Safe RoleDefinition / deck sanitisation for Host-edited and
 * custom roles. Accepts arbitrary role ids (not catalog-only); whitelists
 * enums and clamps strings/numbers so the night engine never sees junk.
 */

import { createDefaultPartyDeck } from './defaultRoles.js';
import type {
  ActionType,
  Faction,
  ResolutionBand,
  RoleDefinition,
  WakeFrequency,
  WakeSchedule,
  WinCondition,
} from './types.js';

const FACTIONS = new Set<Faction>([
  'VILLAGE',
  'IMPOSTORS',
  'NEUTRAL',
  'SOLO',
]);

const WIN_CONDITIONS = new Set<WinCondition>([
  'ELIMINATE_ALL_IMPOSTORS',
  'EQUAL_OR_GREATER_THAN_VILLAGERS',
  'LAST_SURVIVOR',
  'CUSTOM_SURVIVE',
]);

const FREQUENCIES = new Set<WakeFrequency>([
  'FIRST_NIGHT_ONLY',
  'EVERY_NIGHT',
  'ODD_NIGHTS',
  'EVEN_NIGHTS',
  'ON_TRIGGER',
]);

const ACTION_TYPES = new Set<ActionType>([
  'SINGLE_TARGET',
  'FACTION_VOTE',
  'INSPECT_TARGET',
  'PASSIVE_INFO',
  'NONE',
]);

const RESOLUTION_BANDS = new Set<ResolutionBand>([
  'PROTECTION',
  'INVESTIGATION',
  'ATTACK',
  'DELAYED',
]);

const INSPECT_REVEALS = new Set(['FACTION', 'ROLE'] as const);

/** Lucide icon names used by RoleReveal (unknown names fall back to Users). */
const ICON_NAMES = new Set([
  'Users',
  'Shield',
  'ShieldCheck',
  'Eye',
  'ScanSearch',
  'Bell',
  'Moon',
  'UserX',
  'Sword',
  'Drama',
  'Sparkles',
  'GitBranch',
  'Ear',
  'Wand2',
  'Gavel',
  'Axe',
  'Split',
  'Fingerprint',
  'Bird',
  'Flame',
]);

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
/** Role ids: letter start, then alnum / _ / - ; max 64. Custom ids allowed. */
const ROLE_ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

const MAX_DECK_ROLES = 64;
const MAX_NAME = 48;
const MAX_DESCRIPTION = 500;
const MAX_PROMPT = 200;
const MAX_COUNT = 20;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sliceStr(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, max);
}

function sanitizeWakeSchedule(raw: unknown): WakeSchedule {
  const o = asRecord(raw) ?? {};
  const frequency = FREQUENCIES.has(o.frequency as WakeFrequency)
    ? (o.frequency as WakeFrequency)
    : 'EVERY_NIGHT';
  const actionType = ACTION_TYPES.has(o.actionType as ActionType)
    ? (o.actionType as ActionType)
    : 'NONE';

  const schedule: WakeSchedule = {
    frequency,
    priority: clampInt(o.priority, 0, 999, 50),
    actionType,
    timeMaskingDuration: clampInt(o.timeMaskingDuration, 0, 600_000, 20_000),
  };

  if (RESOLUTION_BANDS.has(o.resolutionBand as ResolutionBand)) {
    schedule.resolutionBand = o.resolutionBand as ResolutionBand;
  }

  const wakePrompt = sliceStr(o.wakePrompt, MAX_PROMPT).trim();
  if (wakePrompt) schedule.wakePrompt = wakePrompt;

  const passiveInfoText = sliceStr(o.passiveInfoText, MAX_PROMPT).trim();
  if (passiveInfoText) schedule.passiveInfoText = passiveInfoText;

  return schedule;
}

/**
 * Validate and normalise one role card. Returns `null` if the id is unusable.
 * Custom (non-catalog) ids are accepted when they match `ROLE_ID`.
 */
export function sanitizeRoleDefinition(raw: unknown): RoleDefinition | null {
  const o = asRecord(raw);
  if (!o) return null;

  const id = sliceStr(o.id, 64).trim();
  if (!ROLE_ID.test(id)) return null;

  const name = sliceStr(o.name, MAX_NAME).trim() || id;
  const description = sliceStr(o.description, MAX_DESCRIPTION);
  const faction = FACTIONS.has(o.faction as Faction)
    ? (o.faction as Faction)
    : 'VILLAGE';
  const winCondition = WIN_CONDITIONS.has(o.winCondition as WinCondition)
    ? (o.winCondition as WinCondition)
    : 'ELIMINATE_ALL_IMPOSTORS';

  let colorHex = sliceStr(o.colorHex, 7, '#C4B5A0');
  if (!HEX_COLOR.test(colorHex)) colorHex = '#C4B5A0';

  const iconRaw = sliceStr(o.iconName, 32, 'Users');
  const iconName = ICON_NAMES.has(iconRaw) ? iconRaw : 'Users';

  const role: RoleDefinition = {
    id,
    name,
    faction,
    description,
    colorHex,
    iconName,
    winCondition,
    count: clampInt(o.count, 0, MAX_COUNT, 0),
    wakeSchedule: sanitizeWakeSchedule(o.wakeSchedule),
  };

  if (o.grantsProtection === true) role.grantsProtection = true;
  if (o.isLethal === true) role.isLethal = true;
  if (INSPECT_REVEALS.has(o.inspectReveals as 'FACTION' | 'ROLE')) {
    role.inspectReveals = o.inspectReveals as 'FACTION' | 'ROLE';
  }

  return role;
}

/**
 * Sanitize a Host-submitted party deck. Empty / invalid → default party deck
 * (count ≥ 1 only). Dedupes by `id` (first wins). Caps length at
 * {@link MAX_DECK_ROLES}. Count-0 rows are dropped.
 */
export function sanitizeRoleDeck(deck: unknown): RoleDefinition[] {
  if (!Array.isArray(deck) || deck.length === 0) {
    return createDefaultPartyDeck();
  }

  const seen = new Set<string>();
  const out: RoleDefinition[] = [];
  for (const entry of deck) {
    if (out.length >= MAX_DECK_ROLES) break;
    const role = sanitizeRoleDefinition(entry);
    // Party deck: drop count-0 rows (catalog leftovers stay addable client-side).
    if (!role || role.count <= 0 || seen.has(role.id)) continue;
    seen.add(role.id);
    out.push(role);
  }

  return out.length > 0 ? out : createDefaultPartyDeck();
}

/** Sum of positive copy counts (seats dealt, excluding zeroed roles). */
export function deckSeatTotal(deck: RoleDefinition[]): number {
  return deck.reduce((sum, r) => sum + Math.max(0, r.count), 0);
}

export const ROLE_DECK_LIMITS = {
  maxRoles: MAX_DECK_ROLES,
  maxName: MAX_NAME,
  maxDescription: MAX_DESCRIPTION,
  maxCount: MAX_COUNT,
  maxPrompt: MAX_PROMPT,
} as const;

export const ROLE_ENUMS = {
  factions: [...FACTIONS] as Faction[],
  winConditions: [...WIN_CONDITIONS] as WinCondition[],
  frequencies: [...FREQUENCIES] as WakeFrequency[],
  actionTypes: [...ACTION_TYPES] as ActionType[],
  resolutionBands: [...RESOLUTION_BANDS] as ResolutionBand[],
  iconNames: [...ICON_NAMES] as string[],
} as const;
