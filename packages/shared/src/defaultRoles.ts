/**
 * @fileoverview Default original role deck for Nocturna.
 *
 * All names, descriptions, and abilities are original folklore-inspired
 * constructs. Do not rename these to trademarked commercial titles.
 */

import type { RoleDefinition } from './types.js';

/**
 * Balanced starter deck for 6–10 players.
 * Hosts can clone, reorder priorities, and export as JSON presets.
 */
export const DEFAULT_ROLE_DECK: RoleDefinition[] = [
  {
    id: 'cittadino',
    name: 'Cittadino',
    faction: 'VILLAGE',
    description:
      'Abitante del villaggio senza poteri notturni. Vince eliminando tutte le Ombre.',
    colorHex: '#C4B5A0',
    iconName: 'Users',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 4,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 100,
      actionType: 'NONE',
      timeMaskingDuration: 0,
    },
  },
  {
    id: 'guardia',
    name: 'Guardia',
    faction: 'VILLAGE',
    description:
      'Ogni notte può proteggere un giocatore vivente. Il protetto sopravvive a un attacco.',
    colorHex: '#3D8B7A',
    iconName: 'Shield',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 1,
    grantsProtection: true,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 10,
      actionType: 'SINGLE_TARGET',
      resolutionBand: 'PROTECTION',
      timeMaskingDuration: 20_000,
      wakePrompt: 'Scegli chi proteggere stanotte.',
    },
  },
  {
    id: 'oracolo',
    name: 'Oracolo',
    faction: 'VILLAGE',
    description:
      'Indaga un giocatore per scoprire se appartiene al Villaggio o alle Ombre.',
    colorHex: '#6B8CAE',
    iconName: 'Eye',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 1,
    inspectReveals: 'FACTION',
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 20,
      actionType: 'INSPECT_TARGET',
      resolutionBand: 'INVESTIGATION',
      timeMaskingDuration: 20_000,
      wakePrompt: 'Scegli chi indagare. Il risultato arriverà all\'alba.',
    },
  },
  {
    id: 'ombra',
    name: 'Ombra',
    faction: 'IMPOSTORS',
    description:
      'Infiltrato del villaggio. Di notte le Ombre votano insieme una vittima.',
    colorHex: '#8B1E3F',
    iconName: 'Moon',
    winCondition: 'EQUAL_OR_GREATER_THAN_VILLAGERS',
    count: 2,
    isLethal: true,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 30,
      actionType: 'FACTION_VOTE',
      resolutionBand: 'ATTACK',
      timeMaskingDuration: 25_000,
      wakePrompt: 'Le Ombre cacciano. Accordatevi su una vittima.',
    },
  },
  {
    id: 'vagabondo',
    name: 'Vagabondo',
    faction: 'SOLO',
    description:
      'Solitario: vince se rimane l\'unico sopravvissuto a fine partita.',
    colorHex: '#B8860B',
    iconName: 'Sparkles',
    winCondition: 'LAST_SURVIVOR',
    count: 0,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 40,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 12_000,
      wakePrompt: 'Ascolta il silenzio.',
      passiveInfoText: 'Il Vagabondo osserva. Nessuna azione richiesta.',
    },
  },
];

/**
 * Returns a deep clone of the default deck so Host mutations never alias
 * the module-level constant.
 */
export function createDefaultRoleDeck(): RoleDefinition[] {
  return DEFAULT_ROLE_DECK.map((r) => ({
    ...r,
    wakeSchedule: { ...r.wakeSchedule },
  }));
}
