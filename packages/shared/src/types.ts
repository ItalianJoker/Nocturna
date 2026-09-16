/**
 * @fileoverview Core TypeScript data models for Nocturna.
 *
 * Architectural principles encoded in these types:
 * - Server is authoritative: clients never receive `GameState` / `MasterGameState`
 *   unless they hold the Master privilege (`isMaster: true`).
 * - Role behaviour is fully data-driven via `RoleDefinition` + `WakeSchedule`;
 *   no role-specific branching belongs in application code.
 * - Night effects are queued as `PendingAction` and resolved atomically so
 *   protections always beat attacks and investigations read pre-attack state.
 * - Sensory anti-leaking is expressed in `RoomSettings` (haptics default OFF
 *   for individuals; when ON, only a universal heartbeat is legal).
 *
 * Naming is original ("Nocturna", Villaggio / Ombre / Neutrali) and avoids
 * any trademarked game titles or commercial copy.
 */

/** Stable identifier for a room instance (typically a 6-digit PIN). */
export type RoomId = string;

/** Stable identifier for a player within a room. */
export type PlayerId = string;

/** Opaque reconnect token persisted in the client `localStorage`. */
export type SessionToken = string;

/** Stable identifier for a role definition within a deck/preset. */
export type RoleId = string;

/**
 * Faction buckets used by win-condition evaluation and UI colouring.
 * - `VILLAGE` — Cittadini / Villaggio
 * - `IMPOSTORS` — Ombre / Predatori / Infiltrati
 * - `NEUTRAL` — Neutrali (may have custom goals)
 * - `SOLO` — Solitari (last-survivor style)
 */
export type Faction = 'VILLAGE' | 'IMPOSTORS' | 'NEUTRAL' | 'SOLO';

/**
 * Declarative win conditions evaluated server-side after every phase transition.
 * Custom logic for `CUSTOM_SURVIVE` simply checks that the role-holder is alive
 * when a terminal state is reached for other factions.
 */
export type WinCondition =
  | 'ELIMINATE_ALL_IMPOSTORS'
  | 'EQUAL_OR_GREATER_THAN_VILLAGERS'
  | 'LAST_SURVIVOR'
  | 'CUSTOM_SURVIVE';

/**
 * How often a role is woken during the night scheduler pass.
 * `ON_TRIGGER` roles are skipped by the automatic queue and only inserted when
 * an external trigger (Master force-call or another role's effect) requests them.
 */
export type WakeFrequency =
  | 'FIRST_NIGHT_ONLY'
  | 'EVERY_NIGHT'
  | 'ODD_NIGHTS'
  | 'EVEN_NIGHTS'
  | 'ON_TRIGGER';

/**
 * Action UI contract presented to the woken player(s).
 * `FACTION_VOTE` shares a live ballot among alive members of the same faction
 * (votes visible only to that faction — never leaked to outsiders).
 */
export type ActionType =
  | 'SINGLE_TARGET'
  | 'FACTION_VOTE'
  | 'INSPECT_TARGET'
  | 'PASSIVE_INFO'
  | 'NONE';

/**
 * Priority bands for night-effect resolution.
 * Lower numeric band runs first. Within a band, lower `priority` wins.
 *
 * Why this order exists (anti-ambiguity):
 * 1. Protections must land before attacks so shields actually matter.
 * 2. Investigations read the *pre-attack* board so a killed target still
 *    yields correct intel from earlier in the same night.
 * 3. Attacks apply after both of the above.
 * 4. Delayed curses / faction swaps mutate state last so they never
 *    retroactively invalidate the night's investigations.
 */
export type ResolutionBand =
  | 'PROTECTION'
  | 'INVESTIGATION'
  | 'ATTACK'
  | 'DELAYED';

/** High-level FSM phases for a Nocturna room. */
export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAWN'
  | 'DISCUSSION'
  | 'TRIBUNAL'
  | 'BALLOT'
  | 'ENDED';

/** Host-selected operating mode (lobby setting). */
export type ModeratorMode = 'AUTOMATED' | 'ASSISTED';

/** How tribunal ties are settled. */
export type TieBreakPolicy = 'NO_ELIMINATION' | 'RUNOFF';

/** Whether tribunal votes are shown publicly as they arrive. */
export type VoteVisibility = 'SECRET' | 'PUBLIC';

/**
 * Haptic policy for a room.
 *
 * Default (`NONE`) emits zero vibration — absolute sensory silence.
 * `UNIVERSAL_HEARTBEAT` fires the same pattern on *every* connected device
 * whenever a night micro-turn changes, so nobody can deduce who is awake
 * from which phone buzzed.
 *
 * Individual / role-targeted vibration is intentionally absent from this union
 * to make leaking via haptics a type error.
 */
export type HapticPolicy = 'NONE' | 'UNIVERSAL_HEARTBEAT';

/**
 * Describes *when* and *how* a role is woken by the night narrator.
 */
export interface WakeSchedule {
  /** Wake cadence relative to the night counter. */
  frequency: WakeFrequency;
  /**
   * Sequential call order. Convention used by default presets:
   * 10 = protection, 20 = investigation, 30 = shadow attack, 40+ = tertiary.
   */
  priority: number;
  /** UI / resolution contract for this wake. */
  actionType: ActionType;
  /**
   * Minimum micro-turn duration (ms) in `AUTOMATED` mode.
   * The server never advances early on player confirm — this defeats timing
   * attacks where table neighbours hear who finished first.
   */
  timeMaskingDuration: number;
  /**
   * Resolution band this action belongs to when flushed at dawn.
   * Required for actionable types; ignored for `NONE` / `PASSIVE_INFO`.
   */
  resolutionBand?: ResolutionBand;
  /**
   * Optional flavour prompt shown while the player is awake
   * (kept low-contrast on the stealth night UI).
   */
  wakePrompt?: string;
  /**
   * Optional passive text for `PASSIVE_INFO` actions
   * (e.g. "Tonight the shadows hunt.").
   */
  passiveInfoText?: string;
}

/**
 * Fully declarative role card. Hosts customise decks via JSON presets;
 * the engine never hard-codes role behaviour beyond interpreting these fields.
 */
export interface RoleDefinition {
  id: RoleId;
  name: string;
  faction: Faction;
  description: string;
  /** Accent colour used sparingly on the role-reveal card. */
  colorHex: string;
  /** Lucide icon name (resolved on the client). */
  iconName: string;
  winCondition: WinCondition;
  /** Number of copies seeded into the deck when the Host starts the game. */
  count: number;
  wakeSchedule: WakeSchedule;
  /**
   * When true, this role's night action grants protection to its target
   * (used by the resolution engine for `PROTECTION` band actions).
   */
  grantsProtection?: boolean;
  /**
   * When true, this role's night action is treated as a lethal attack
   * (used by the resolution engine for `ATTACK` band actions).
   */
  isLethal?: boolean;
  /**
   * Inspection depth for `INSPECT_TARGET`:
   * - `FACTION` reveals only Villaggio / Ombre / Neutrale
   * - `ROLE` reveals the exact role name
   */
  inspectReveals?: 'FACTION' | 'ROLE';
}

/**
 * Lobby / room configuration chosen by the Host before kick-off.
 * Audio and haptic fields drive the anti-leaking sensory protocol.
 */
export interface RoomSettings {
  roomName: string;
  moderatorMode: ModeratorMode;
  /**
   * Default is `NONE` (no individual vibration).
   * Enabling haptics only unlocks the universal village heartbeat.
   */
  hapticPolicy: HapticPolicy;
  /** Continuous ambient loop on all devices during AUTOMATED nights. */
  ambientAudioEnabled: boolean;
  /** Discussion timer length in milliseconds. */
  discussionDurationMs: number;
  /** Tribunal voting window in milliseconds. */
  tribunalDurationMs: number;
  tieBreakPolicy: TieBreakPolicy;
  voteVisibility: VoteVisibility;
  /**
   * Global fallback micro-turn duration used when a role schedule omits one.
   * Also used as the lower bound in AUTOMATED masking.
   */
  defaultNightTurnDurationMs: number;
  /** Allow spectators to join after ROLE_REVEAL (receive sanitised view only). */
  allowLateJoin: boolean;
}

/**
 * A participant in a room. Masters are excluded from the role deck and from
 * win-condition tallies when `isMaster` is true.
 */
export interface Player {
  id: PlayerId;
  displayName: string;
  /** Token used to re-bind a new socket after lock-screen / network blips. */
  sessionToken: SessionToken;
  socketId: string | null;
  isHost: boolean;
  /**
   * When true in ASSISTED mode, this player receives `MasterGameState`
   * (God-View) and is excluded from role assignment / win math.
   */
  isMaster: boolean;
  isConnected: boolean;
  isAlive: boolean;
  /** Assigned after ROLE_REVEAL; null while still in lobby. */
  roleId: RoleId | null;
  /** Soft flags mutated during night resolution (cleared at dawn announce). */
  isProtected: boolean;
  /** Set when an attack lands; consumed when producing dawn victims. */
  markedForDeath: boolean;
  joinedAt: number;
}

/**
 * Queued night effect. Actions are NOT applied when submitted — they wait for
 * the atomic dawn flush so resolution order stays deterministic.
 */
export interface PendingAction {
  /** Unique id for Master cancel / audit. */
  id: string;
  nightNumber: number;
  actorPlayerId: PlayerId;
  actorRoleId: RoleId;
  actionType: ActionType;
  resolutionBand: ResolutionBand;
  /**
   * Schedule priority copied from the role definition so flush ordering can
   * break ties inside the same band without re-looking up the deck.
   */
  priority: number;
  /** Target player id (single-target / inspect / faction vote winner). */
  targetPlayerId: PlayerId | null;
  /** Raw faction ballot map when actionType is FACTION_VOTE. */
  factionVotes?: Record<PlayerId, PlayerId>;
  /** Wall-clock submission time (audit / Master UI). */
  submittedAt: number;
  /** True when the server auto-inserted a no-op due to timeout / disconnect. */
  isNullAction: boolean;
}

/**
 * One micro-turn produced by `buildNightTurnQueue` for the current night.
 */
export interface ScheduledTurn {
  /** Stable key for the turn inside the night queue. */
  turnId: string;
  roleId: RoleId;
  roleName: string;
  actionType: ActionType;
  priority: number;
  resolutionBand: ResolutionBand | null;
  /** Players who should see the active action UI for this turn. */
  actorPlayerIds: PlayerId[];
  /** Masked duration (ms) the server will enforce in AUTOMATED mode. */
  durationMs: number;
  wakePrompt: string;
  passiveInfoText?: string;
  /** Faction shared for FACTION_VOTE UIs. */
  faction?: Faction;
}

/** Outcome of a single resolved pending action (for logs / Master UI). */
export interface ResolvedActionLog {
  actionId: string;
  band: ResolutionBand;
  actorPlayerId: PlayerId;
  actorRoleId: RoleId;
  targetPlayerId: PlayerId | null;
  summary: string;
  /** Present for successful inspections. */
  inspectResult?: {
    targetPlayerId: PlayerId;
    revealed: string;
  };
}

/**
 * Result of `resolveNightActions` — applied atomically onto the living board
 * before the room transitions into DAWN.
 */
export interface ResolutionResult {
  /** Players who died this night after protections were considered. */
  eliminatedPlayerIds: PlayerId[];
  /** Players who were attacked but survived due to protection. */
  savedPlayerIds: PlayerId[];
  /** Per-actor investigation payloads to deliver privately at dawn. */
  investigationResults: Array<{
    actorPlayerId: PlayerId;
    targetPlayerId: PlayerId;
    revealed: string;
  }>;
  /** Human-readable audit trail (Master + end-game report). */
  logs: ResolvedActionLog[];
  /** Mutated player snapshots (protections cleared, deaths applied). */
  players: Player[];
}

/**
 * Public / private info shown to a regular player about themselves.
 * Never includes other players' roles.
 */
export interface PrivatePlayerView {
  playerId: PlayerId;
  roleId: RoleId | null;
  roleName: string | null;
  roleDescription: string | null;
  faction: Faction | null;
  colorHex: string | null;
  iconName: string | null;
  /** Private investigation result from the previous night, if any. */
  lastInspectResult: {
    targetName: string;
    revealed: string;
  } | null;
}

/**
 * Night-turn view safe for a non-master client.
 * Actors see prompts + eligible targets; sleepers see only the stealth sleep UI.
 */
export interface SanitizedNightView {
  nightNumber: number;
  /** True when *this* client is among the current turn actors. */
  isAwake: boolean;
  currentTurn: {
    turnId: string;
    roleName: string;
    actionType: ActionType;
    wakePrompt: string;
    passiveInfoText?: string;
    /** Eligible living targets (ids + display names only). */
    eligibleTargets: Array<{ id: PlayerId; displayName: string }>;
    /**
     * For FACTION_VOTE: live tallies visible only to the same faction.
     * Always empty for outsiders / sleepers.
     */
    factionVoteTally: Record<PlayerId, number>;
    /** Absolute server timestamp when this micro-turn ends. */
    turnEndsAt: number | null;
    hasSubmitted: boolean;
  } | null;
}

/**
 * Payload every non-master socket is allowed to see.
 * Built exclusively on the server — clients must never filter a richer state.
 */
export interface SanitizedGameState {
  roomId: RoomId;
  phase: GamePhase;
  settings: Pick<
    RoomSettings,
    | 'roomName'
    | 'moderatorMode'
    | 'hapticPolicy'
    | 'ambientAudioEnabled'
    | 'discussionDurationMs'
    | 'tribunalDurationMs'
    | 'voteVisibility'
    | 'tieBreakPolicy'
  >;
  /** Absolute server timestamp; clients only render countdown from this. */
  phaseEndsAt: number | null;
  nightNumber: number;
  dayNumber: number;
  /**
   * Public roster: names, alive/connected flags — never roles.
   * The local player can correlate with `you` for private fields.
   */
  players: Array<{
    id: PlayerId;
    displayName: string;
    isHost: boolean;
    isMaster: boolean;
    isConnected: boolean;
    isAlive: boolean;
  }>;
  you: PrivatePlayerView;
  night: SanitizedNightView | null;
  /**
   * Dawn victims announced after resolution (names only).
   * Cleared when discussion begins.
   */
  dawnAnnouncement: {
    victimNames: string[];
    savedNames: string[];
  } | null;
  /**
   * Tribunal ballot as seen by this player.
   * In SECRET mode, only own vote + aggregate counts (if Host enables live
   * totals) are present; PUBLIC mode shows voter → target mapping.
   */
  tribunal: {
    votes: Record<PlayerId, PlayerId | 'ABSTAIN' | null>;
    /** Visible tallies — may be omitted/empty under SECRET until reveal. */
    tallies: Record<PlayerId | 'ABSTAIN', number>;
    myVote: PlayerId | 'ABSTAIN' | null;
    runoffOf: PlayerId[] | null;
  } | null;
  /** Populated only in ENDED phase. */
  ending: {
    winningFaction: Faction | 'NONE' | null;
    winningPlayerIds: PlayerId[];
    reveal: Array<{
      playerId: PlayerId;
      displayName: string;
      roleName: string;
      faction: Faction;
      survived: boolean;
    }>;
    summary: string;
  } | null;
  /** Server wall clock at emission (helps clients correct drift). */
  serverNow: number;
  /**
   * When true, the client should fire the universal haptic pattern.
   * Always broadcast to every socket together — never selectively.
   */
  hapticPulseSeq: number;
  /**
   * Host-only deck mirror while in LOBBY (so AUTOMATED hosts can edit
   * schedules without receiving a full MasterGameState).
   * Absent / undefined for every other player and phase.
   */
  hostDeck?: RoleDefinition[];
}

/**
 * God-View payload exclusive to `isMaster: true` sockets in ASSISTED mode.
 * Extends the sanitised shape with full role knowledge and night stepper controls.
 */
export interface MasterGameState extends Omit<SanitizedGameState, 'you' | 'night'> {
  /** Full private roster including roles and protection / death marks. */
  masterRoster: Array<{
    id: PlayerId;
    displayName: string;
    isHost: boolean;
    isMaster: boolean;
    isConnected: boolean;
    isAlive: boolean;
    roleId: RoleId | null;
    roleName: string | null;
    faction: Faction | null;
    isProtected: boolean;
    markedForDeath: boolean;
  }>;
  /** Complete night queue for the current night (including future turns). */
  nightQueue: ScheduledTurn[];
  currentTurnIndex: number;
  pendingActions: PendingAction[];
  /** True when the Master has paused the night / day timer. */
  isPaused: boolean;
  /** Deck currently configured for the room (editable in lobby). */
  roleDeck: RoleDefinition[];
}

/**
 * Authoritative in-memory room state. Never serialised wholesale to clients.
 */
export interface GameState {
  roomId: RoomId;
  createdAt: number;
  hostPlayerId: PlayerId;
  settings: RoomSettings;
  phase: GamePhase;
  phaseEndsAt: number | null;
  nightNumber: number;
  dayNumber: number;
  players: Map<PlayerId, Player>;
  /** Active role deck (copy of Host configuration at start, mutable in lobby). */
  roleDeck: RoleDefinition[];
  nightQueue: ScheduledTurn[];
  currentTurnIndex: number;
  pendingActions: PendingAction[];
  /**
   * Investigation results keyed by actor, delivered into that player's
   * sanitised view at dawn and cleared afterward.
   */
  pendingInvestigations: Map<
    PlayerId,
    { targetPlayerId: PlayerId; revealed: string }
  >;
  /** Tribunal votes: voterId → targetId | ABSTAIN. */
  tribunalVotes: Map<PlayerId, PlayerId | 'ABSTAIN'>;
  runoffCandidates: PlayerId[] | null;
  dawnVictims: PlayerId[];
  dawnSaved: PlayerId[];
  isPaused: boolean;
  /** Monotonic counter bumped on every universal haptic broadcast. */
  hapticPulseSeq: number;
  winningFaction: Faction | 'NONE' | null;
  winningPlayerIds: PlayerId[];
  actionLog: ResolvedActionLog[];
  /** Timer handle bookkeeping (Node timeouts) — not part of serialisation. */
  timerToken: string | null;
}

/** JSON preset exportable by the Host and re-imported from localStorage / file. */
export interface RolePreset {
  name: string;
  version: 1;
  settings?: Partial<RoomSettings>;
  roles: RoleDefinition[];
  exportedAt: number;
}

/** Default factory values used when a Host creates a fresh room. */
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  roomName: 'Nocturna',
  moderatorMode: 'AUTOMATED',
  /** Absolute sensory silence unless the Host explicitly enables heartbeat. */
  hapticPolicy: 'NONE',
  ambientAudioEnabled: true,
  discussionDurationMs: 180_000,
  tribunalDurationMs: 60_000,
  tieBreakPolicy: 'NO_ELIMINATION',
  voteVisibility: 'SECRET',
  defaultNightTurnDurationMs: 20_000,
  allowLateJoin: false,
};
