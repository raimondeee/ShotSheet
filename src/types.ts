/**
 * ShotSheet data model (v1)
 * Extensible for future stat sheets (penalties, faceoffs, etc.)
 */

export type Side = 'for' | 'against';
export type Outcome = 'goal' | 'miss' | 'save' | 'goal_against';
export type PlotMode = 'our_shot' | 'shot_against';
export type SideFilter = 'for' | 'against' | 'both';
export type Period = 1 | 2 | 3 | 'OT';
export type PeriodFilter = Period | 'all';
export type Strength = 'EV' | 'PP' | 'SH';
export type StrengthFilter = Strength | 'all';
export type OutcomeFilter = Outcome | 'all';
export type UiMode = 'place' | 'review';
export type AppScreen = 'home' | 'chart' | 'reports';
/** Shot x/y are normalized 0–1 in the vertical half-rink image (goal at top). */
export type CoordSpace = 'vert-half-v1';
export const COORD_SPACE_VERT_HALF: CoordSpace = 'vert-half-v1';

export interface Player {
  id: string;
  name: string;
  number?: string;
  role?: 'skater' | 'goalie';
}

export interface Game {
  id: string;
  label: string;
  /** Opponent name, e.g. "Rangers" */
  opponent?: string;
  /** Game date ISO YYYY-MM-DD */
  date?: string;
  /** Rink / city / venue */
  location?: string;
  /** Default YouTube (or other) game film URL */
  videoUrl?: string;
  createdAt: string;
}

export interface ShotEvent {
  id: string;
  gameId: string;
  side: Side;
  outcome: Outcome;
  /**
   * Normalized 0–1 in the vertical half image (top-left origin).
   * x: left boards → right boards; y: goal end (top) → center ice (bottom).
   * Undefined = unplaced (click to place).
   */
  x?: number;
  y?: number;
  /** Shooter when side=for */
  playerId?: string;
  /** Our goalie when side=against */
  goalieId?: string;
  period?: Period;
  /** Even strength / power play / shorthanded; default EV */
  strength?: Strength;
  clock?: string;
  detail?: string;
  /** Seconds into game film (from CSV Video Timestamp) */
  videoTimestampSec?: number;
  /** Per-event clip override (CSV Clip URL); else use game.videoUrl + t= */
  clipUrl?: string;
  createdAt: string;
  /** Reserved for future event kinds beyond shots */
  kind?: 'shot';
}

export interface SeasonStore {
  version: 1;
  /**
   * Coordinate space for shot x/y. Missing / any other value means legacy
   * full-horizontal rink coords and is migrated once on load/import.
   */
  coordSpace?: CoordSpace;
  games: Game[];
  players: Player[];
  shots: ShotEvent[];
  /** Future: penalties, shifts, etc. */
}

export interface Filters {
  gameId: string | 'all';
  playerId: string | 'all';
  goalieId: string | 'all';
  side: SideFilter;
  period: PeriodFilter;
  strength: StrengthFilter;
  outcome: OutcomeFilter;
}

export interface OffenseStats {
  shots: number;
  goals: number;
  misses: number;
  shootingPct: number;
}

export interface DefenseStats {
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  savePct: number;
}
