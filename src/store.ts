import type { Filters, Game, Period, SeasonStore, ShotEvent, Strength } from './types';
import { ensureDefaultRoster } from './roster';

const STORAGE_KEY = 'shotsheet-season-v1';

/** Normalize legacy numeric / string periods into 1|2|3|'OT'. */
export function normalizePeriod(raw: unknown): Period | undefined {
  if (raw === 1 || raw === 2 || raw === 3 || raw === 'OT') return raw;
  if (raw === '1' || raw === '2' || raw === '3') return Number(raw) as 1 | 2 | 3;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'ot' || s === 'overtime' || s === '4') return 'OT';
    if (s === '1' || s === '1st') return 1;
    if (s === '2' || s === '2nd') return 2;
    if (s === '3' || s === '3rd') return 3;
  }
  if (typeof raw === 'number') {
    if (raw === 1 || raw === 2 || raw === 3) return raw;
    if (raw === 4) return 'OT';
  }
  return undefined;
}

export function normalizeStrength(raw: unknown): Strength {
  if (raw === 'EV' || raw === 'PP' || raw === 'SH') return raw;
  if (typeof raw !== 'string') return 'EV';
  const u = raw.trim().toUpperCase();
  if (u === 'EV' || u === 'ES' || u === 'EVEN' || u === '5V5' || u === '5-ON-5') return 'EV';
  if (u === 'PP' || u === 'POWER PLAY' || u === 'POWERPLAY' || u.includes('PP')) return 'PP';
  if (u === 'SH' || u === 'SHG' || u === 'PK' || u === 'SHORTHANDED' || u === 'SHORT-HANDED' || u.includes('SH')) return 'SH';
  // Detail suffixes like "• EV"
  if (/\bEV\b/.test(u)) return 'EV';
  if (/\bPP\b/.test(u)) return 'PP';
  if (/\bSH\b/.test(u)) return 'SH';
  return 'EV';
}

function normalizeShot(s: ShotEvent): ShotEvent {
  const period = normalizePeriod(s.period);
  const strength = normalizeStrength(s.strength);
  return { ...s, period, strength };
}

export function emptySeason(): SeasonStore {
  return { version: 1, games: [], players: ensureDefaultRoster([]), shots: [] };
}

export function loadSeason(): SeasonStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySeason();
    const parsed = JSON.parse(raw) as SeasonStore;
    if (!parsed || parsed.version !== 1) return emptySeason();
    return {
      version: 1,
      games: parsed.games ?? [],
      players: ensureDefaultRoster(parsed.players ?? []),
      shots: (parsed.shots ?? []).map(normalizeShot),
    };
  } catch {
    return emptySeason();
  }
}

export function saveSeason(season: SeasonStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(season));
}

export function exportSeasonJson(season: SeasonStore): string {
  return JSON.stringify(season, null, 2);
}

export function importSeasonJson(json: string): SeasonStore {
  const parsed = JSON.parse(json) as SeasonStore;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid season JSON');
  return {
    version: 1,
    games: Array.isArray(parsed.games) ? parsed.games : [],
    players: ensureDefaultRoster(Array.isArray(parsed.players) ? parsed.players : []),
    shots: (Array.isArray(parsed.shots) ? parsed.shots : []).map(normalizeShot),
  };
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}


/** Build display label from opponent / date / location metadata. */
export function formatGameLabel(game: Game): string {
  const parts: string[] = [];
  const opp = game.opponent?.trim();
  if (opp) parts.push(`vs ${opp}`);
  const date = game.date?.trim();
  if (date) parts.push(date);
  const loc = game.location?.trim();
  if (loc) parts.push(loc);
  if (parts.length) return parts.join(' · ');
  const fallback = game.label?.trim();
  return fallback || 'Untitled game';
}

/** Compose a canonical label from metadata (keeps `label` in sync on save). */
export function composeGameLabel(meta: {
  opponent?: string;
  date?: string;
  location?: string;
  label?: string;
}): string {
  return formatGameLabel({
    id: '',
    label: meta.label ?? '',
    opponent: meta.opponent,
    date: meta.date,
    location: meta.location,
    createdAt: '',
  });
}


export function upsertPlayer(season: SeasonStore, player: import('./types').Player): SeasonStore {
  const idx = season.players.findIndex((p) => p.id === player.id);
  const players = [...season.players];
  if (idx >= 0) players[idx] = { ...players[idx], ...player };
  else players.push(player);
  return { ...season, players };
}

export function upsertGame(season: SeasonStore, game: import('./types').Game): SeasonStore {
  const idx = season.games.findIndex((g) => g.id === game.id);
  const games = [...season.games];
  if (idx >= 0) games[idx] = { ...games[idx], ...game };
  else games.push(game);
  return { ...season, games };
}

export function addShot(season: SeasonStore, shot: ShotEvent): SeasonStore {
  return { ...season, shots: [...season.shots, shot] };
}

export function updateShot(
  season: SeasonStore,
  shotId: string,
  patch: Partial<ShotEvent>,
): SeasonStore {
  return {
    ...season,
    shots: season.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)),
  };
}

export function removeShot(season: SeasonStore, shotId: string): SeasonStore {
  return { ...season, shots: season.shots.filter((s) => s.id !== shotId) };
}

export function filterShots(season: SeasonStore, filters: Filters): ShotEvent[] {
  return season.shots.filter((s) => {
    if (filters.gameId !== 'all' && s.gameId !== filters.gameId) return false;
    if (filters.side === 'for' && s.side !== 'for') return false;
    if (filters.side === 'against' && s.side !== 'against') return false;
    if (filters.period !== 'all' && s.period !== filters.period) return false;
    if (filters.strength !== 'all' && (s.strength ?? 'EV') !== filters.strength) return false;
    if (filters.playerId !== 'all' && s.side === 'for' && s.playerId !== filters.playerId)
      return false;
    if (filters.playerId !== 'all' && s.side === 'against') return false;
    if (filters.goalieId !== 'all' && s.side === 'against' && s.goalieId !== filters.goalieId)
      return false;
    if (filters.goalieId !== 'all' && s.side === 'for') return false;
    if (filters.outcome !== 'all' && s.outcome !== filters.outcome) return false;
    return true;
  });
}

export function defaultFilters(): Filters {
  return {
    gameId: 'all',
    playerId: 'all',
    goalieId: 'all',
    side: 'both',
    period: 'all',
    strength: 'all',
    outcome: 'all',
  };
}

export function periodLabel(p: Period | undefined): string {
  if (p == null) return '?';
  return p === 'OT' ? 'OT' : String(p);
}

export function strengthLabel(st: Strength | undefined): string {
  return st ?? 'EV';
}

export function strengthCounts(shots: ShotEvent[]): { EV: number; PP: number; SH: number } {
  const out = { EV: 0, PP: 0, SH: 0 };
  for (const s of shots) {
    const k = s.strength ?? 'EV';
    out[k]++;
  }
  return out;
}
