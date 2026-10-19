/**
 * @fileoverview Original Nocturna role catalog (Villaggio / Ombre / Neutrali).
 *
 * Naming follows a shared nocturnal fiction: night, silence, dawn, shadows.
 * Mechanical archetypes are public-domain social-deduction *functions* only.
 * Do not use trademarked product or commercial character names here or in UI.
 */

import type { RoleDefinition } from './types.js';

/**
 * Full catalog. Default `count` values seed a balanced mid-size table;
 * Hosts zero-out or raise copies, or apply recommended setups.
 *
 * Stable `id` values are snake-case keys (not display names). Display `name`
 * is the Nocturna fiction label shown in UI (overridable by Host / i18n).
 */
export const DEFAULT_ROLE_DECK: RoleDefinition[] = [
  {
    id: 'cittadino',
    name: 'Cittadino',
    faction: 'VILLAGE',
    description:
      'Dorme senza poteri. Vince quando l’ultima Ombra cade sotto il tribunale o all’alba.',
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
    name: 'Custode',
    faction: 'VILLAGE',
    description:
      'Ogni notte sceglie un vivo da mettere al riparo: se le Ombre lo colpiscono, sopravvive all’alba.',
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
      wakePrompt: 'Chi metti al riparo stanotte?',
    },
  },
  {
    id: 'baluardo',
    name: 'Baluardo',
    faction: 'VILLAGE',
    description:
      'Solo nella prima notte può erigere uno scudo su un vivo. Poi torna nel silenzio.',
    colorHex: '#2F6F5E',
    iconName: 'ShieldCheck',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    grantsProtection: true,
    wakeSchedule: {
      frequency: 'FIRST_NIGHT_ONLY',
      priority: 12,
      actionType: 'SINGLE_TARGET',
      resolutionBand: 'PROTECTION',
      timeMaskingDuration: 18_000,
      wakePrompt: 'Prima notte: chi proteggi?',
    },
  },
  {
    id: 'oracolo',
    name: 'Oracolo',
    faction: 'VILLAGE',
    description:
      'Nella notte indaga un vivo e all’alba sa se appartiene al Villaggio o alle Ombre.',
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
      wakePrompt: 'Chi vuoi leggere nella notte?',
    },
  },
  {
    id: 'lunavista',
    name: 'Lunavista',
    faction: 'VILLAGE',
    description:
      'Nelle notti di luna dispari scruta un vivo e all’alba ne conosce il ruolo esatto.',
    colorHex: '#5B7FA0',
    iconName: 'ScanSearch',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    inspectReveals: 'ROLE',
    wakeSchedule: {
      frequency: 'ODD_NIGHTS',
      priority: 22,
      actionType: 'INSPECT_TARGET',
      resolutionBand: 'INVESTIGATION',
      timeMaskingDuration: 22_000,
      wakePrompt: 'Notti dispari: chi scruti sotto la luna?',
    },
  },
  {
    id: 'veglia',
    name: 'Veglia',
    faction: 'VILLAGE',
    description:
      'Non agisce: nel silenzio riceve solo un breve monito. Vince col Villaggio.',
    colorHex: '#8A9A7B',
    iconName: 'Bell',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 90,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 10_000,
      wakePrompt: 'Ascolta la notte.',
      passiveInfoText: 'La Veglia resta immobile. Nessuna azione richiesta.',
    },
  },
  {
    id: 'eco',
    name: 'Eco',
    faction: 'VILLAGE',
    description:
      'Nelle notti pari riceve un monito: riecheggia chi è caduto al tribunale del giorno.',
    colorHex: '#6A8A8A',
    iconName: 'Ear',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    wakeSchedule: {
      frequency: 'EVEN_NIGHTS',
      priority: 5,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 12_000,
      wakePrompt: 'Ascolta l’eco.',
      passiveInfoText:
        'Pensa a chi è stato eliminato di giorno. Nessuna azione da scegliere.',
    },
  },
  {
    id: 'legame',
    name: 'Legame',
    faction: 'VILLAGE',
    description:
      'Due anime legate: solo la prima notte si riconoscono nel buio. Vince col Villaggio. Aggiungi sempre due copie.',
    colorHex: '#7A8B6A',
    iconName: 'Users',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    wakeSchedule: {
      frequency: 'FIRST_NIGHT_ONLY',
      priority: 8,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 14_000,
      wakePrompt: 'Cercatevi in silenzio.',
      passiveInfoText:
        'I Legami si riconoscono. Poi richiudete gli occhi — nessuna altra azione.',
    },
  },
  {
    id: 'ombra',
    name: 'Ombra',
    faction: 'IMPOSTORS',
    description:
      'Infiltrato del villaggio. Di notte le Ombre votano insieme una vittima da far sparire all’alba.',
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
    id: 'caccianotte',
    name: 'Caccianotte',
    faction: 'IMPOSTORS',
    description:
      'Caccia col branco: vota con le altre Ombre la preda della notte.',
    colorHex: '#6B1530',
    iconName: 'UserX',
    winCondition: 'EQUAL_OR_GREATER_THAN_VILLAGERS',
    count: 0,
    isLethal: true,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 30,
      actionType: 'FACTION_VOTE',
      resolutionBand: 'ATTACK',
      timeMaskingDuration: 25_000,
      wakePrompt: 'Accordati sulle Ombre: chi sparisce stanotte?',
    },
  },
  {
    id: 'artiglio',
    name: 'Artiglio',
    faction: 'IMPOSTORS',
    description:
      'Nelle notti pari colpisce da solo, oltre al voto del branco: sceglie un vivo da abbattere.',
    colorHex: '#A12A45',
    iconName: 'Sword',
    winCondition: 'EQUAL_OR_GREATER_THAN_VILLAGERS',
    count: 0,
    isLethal: true,
    wakeSchedule: {
      frequency: 'EVEN_NIGHTS',
      priority: 35,
      actionType: 'SINGLE_TARGET',
      resolutionBand: 'ATTACK',
      timeMaskingDuration: 20_000,
      wakePrompt: 'Notti pari: chi colpire in silenzio?',
    },
  },
  {
    id: 'simulacro',
    name: 'Simulacro',
    faction: 'IMPOSTORS',
    description:
      'Sembra un Cittadino e non si sveglia, ma vince con le Ombre — senza sapere chi sono.',
    colorHex: '#5C4A52',
    iconName: 'Drama',
    winCondition: 'EQUAL_OR_GREATER_THAN_VILLAGERS',
    count: 0,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 110,
      actionType: 'NONE',
      timeMaskingDuration: 0,
    },
  },
  {
    id: 'vagabondo',
    name: 'Vagabondo',
    faction: 'SOLO',
    description:
      'Errante solitario: vince soltanto se resta l’ultimo vivo sotto la luna.',
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
  {
    id: 'crocevia',
    name: 'Crocevia',
    faction: 'NEUTRAL',
    description:
      'Neutrale al bivio: vince solo se resta ultimo. Nelle notti dispari ascolta, senza agire.',
    colorHex: '#9A7B4F',
    iconName: 'GitBranch',
    winCondition: 'LAST_SURVIVOR',
    count: 0,
    wakeSchedule: {
      frequency: 'ODD_NIGHTS',
      priority: 45,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 12_000,
      wakePrompt: 'Il crocevia sussurra.',
      passiveInfoText: 'Nessuna azione. Sopravvivi fino a restare solo.',
    },
  },
  {
    id: 'invocatore',
    name: 'Invocatore',
    faction: 'VILLAGE',
    description:
      'Non si sveglia da solo: solo se il Master lo chiama nella notte riceve un monito.',
    colorHex: '#7A6B8A',
    iconName: 'Wand2',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    wakeSchedule: {
      frequency: 'ON_TRIGGER',
      priority: 50,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 15_000,
      wakePrompt: 'Sei stato invocato.',
      passiveInfoText: 'Ascolta il Master. Nessun bersaglio da scegliere.',
    },
  },
  {
    id: 'giudice_notte',
    name: 'Giudice della Notte',
    faction: 'VILLAGE',
    description:
      'Ogni notte indaga un vivo e all’alba ne conosce il ruolo esatto — il verdetto resta privato.',
    colorHex: '#8B7355',
    iconName: 'Gavel',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    inspectReveals: 'ROLE',
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 21,
      actionType: 'INSPECT_TARGET',
      resolutionBand: 'INVESTIGATION',
      timeMaskingDuration: 22_000,
      wakePrompt: 'Chi sottoponi al giudizio della notte?',
    },
  },
  {
    id: 'mannaia',
    name: 'Mannaia',
    faction: 'VILLAGE',
    description:
      'Nelle notti dispari può abbattere un vivo in nome del Villaggio. Un errore è un’accusa eterna.',
    colorHex: '#6B3A3A',
    iconName: 'Axe',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    isLethal: true,
    wakeSchedule: {
      frequency: 'ODD_NIGHTS',
      priority: 38,
      actionType: 'SINGLE_TARGET',
      resolutionBand: 'ATTACK',
      timeMaskingDuration: 20_000,
      wakePrompt: 'Notti dispari: la mannaia cade su chi?',
    },
  },
  {
    id: 'crepuscolo',
    name: 'Crepuscolo',
    faction: 'NEUTRAL',
    description:
      'Porta due volti: di giorno sembra un Cittadino, ma vince solo restando ultimo vivo. Nella prima notte ascolta entrambi i silenzi — poi cammina solo.',
    colorHex: '#5C4E6B',
    iconName: 'Split',
    winCondition: 'LAST_SURVIVOR',
    count: 0,
    wakeSchedule: {
      frequency: 'FIRST_NIGHT_ONLY',
      priority: 42,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 14_000,
      wakePrompt: 'Ascolta il doppio silenzio.',
      passiveInfoText:
        'Ricorda: il tuo volto pubblico è villaggio, la tua vittoria è solitaria. Nessuna azione da scegliere.',
    },
  },
  {
    id: 'soglia',
    name: 'Soglia',
    faction: 'VILLAGE',
    description:
      'Nelle notti pari indaga un vivo e all’alba sa solo se è Villaggio o Ombre.',
    colorHex: '#4A6B7A',
    iconName: 'Fingerprint',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    inspectReveals: 'FACTION',
    wakeSchedule: {
      frequency: 'EVEN_NIGHTS',
      priority: 23,
      actionType: 'INSPECT_TARGET',
      resolutionBand: 'INVESTIGATION',
      timeMaskingDuration: 18_000,
      wakePrompt: 'Notti pari: chi oltrepassa la soglia?',
    },
  },
  {
    id: 'corvo',
    name: 'Corvo',
    faction: 'VILLAGE',
    description:
      'Ogni notte riceve un monito: segna mentalmente un nome da portare all’alba nelle accuse — senza poteri di voto forzato.',
    colorHex: '#3D3D4A',
    iconName: 'Bird',
    winCondition: 'ELIMINATE_ALL_IMPOSTORS',
    count: 0,
    wakeSchedule: {
      frequency: 'EVERY_NIGHT',
      priority: 85,
      actionType: 'PASSIVE_INFO',
      timeMaskingDuration: 10_000,
      wakePrompt: 'Il corvo sussurra un nome.',
      passiveInfoText:
        'Scegli in silenzio chi sospetti. All’alba potrai accusare a voce — nessuna azione sullo schermo.',
    },
  },
  {
    id: 'fiamma_fredda',
    name: 'Fiamma Fredda',
    faction: 'IMPOSTORS',
    description:
      'Solo la prima notte può colpire da sola, prima ancora che il branco si muova.',
    colorHex: '#7A2F45',
    iconName: 'Flame',
    winCondition: 'EQUAL_OR_GREATER_THAN_VILLAGERS',
    count: 0,
    isLethal: true,
    wakeSchedule: {
      frequency: 'FIRST_NIGHT_ONLY',
      priority: 28,
      actionType: 'SINGLE_TARGET',
      resolutionBand: 'ATTACK',
      timeMaskingDuration: 18_000,
      wakePrompt: 'Prima notte: chi spegni nel buio?',
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

/**
 * Clone catalog with every role at `count: 0` (for building recommended setups).
 */
export function createEmptyRoleCatalog(): RoleDefinition[] {
  return createDefaultRoleDeck().map((r) => ({ ...r, count: 0 }));
}

/**
 * Apply a map of roleId → copy count onto a fresh catalog clone.
 * Includes count-0 rows (full catalog shape). Prefer
 * {@link deckFromCounts} for Host party decks.
 */
export function applyRoleCounts(
  counts: Record<string, number>,
): RoleDefinition[] {
  return createDefaultRoleDeck().map((r) => ({
    ...r,
    count: Math.max(0, Math.floor(counts[r.id] ?? 0)),
  }));
}

/**
 * Party deck from a count map: only roles with at least one copy.
 * Zero-count catalog roles are omitted (add later via “missing roles”).
 */
export function deckFromCounts(
  counts: Record<string, number>,
): RoleDefinition[] {
  return applyRoleCounts(counts).filter((r) => r.count > 0);
}

/** Drop roles with count ≤ 0 from an existing deck (active party only). */
export function pruneZeroCountRoles(
  deck: RoleDefinition[],
): RoleDefinition[] {
  return deck.filter((r) => r.count > 0);
}

/**
 * Default mid-table party deck: catalog roles that already have count ≥ 1.
 * Zero-count catalog entries stay out of the list for the add-missing dropdown.
 */
export function createDefaultPartyDeck(): RoleDefinition[] {
  return pruneZeroCountRoles(createDefaultRoleDeck());
}
