import type { Game, Period, Player, SeasonStore, ShotEvent, Strength } from './types';
import { addShot, composeGameLabel, normalizePeriod, normalizeStrength, uid, upsertGame, upsertPlayer } from './store';
import { parseTimestampToSeconds } from './video';

/** Minimal RFC4180-ish CSV parse (handles quoted fields with commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function colIndex(header: string[], ...names: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export function slugId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Parse "#71 Declan Rayner" or "Save — Emmett Sawchuk" / "#1 Emmett Sawchuk" */
export function parsePlayerField(raw: string): { id: string; name: string; number?: string } | null {
  const s = raw.trim();
  if (!s) return null;

  let working = s;
  const saveMatch = working.match(/^Save\s*[—–-]\s*(.+)$/i);
  if (saveMatch) working = saveMatch[1].trim();

  const numMatch = working.match(/^#?\s*(\d+)\s+(.+)$/);
  if (numMatch) {
    const number = numMatch[1];
    const name = numMatch[2].trim();
    return { id: slugId(`${number}-${name}`), name: `#${number} ${name}`, number };
  }

  // Goalie name only after "Save —"
  if (saveMatch) {
    return { id: slugId(working), name: working };
  }

  const hashOnly = working.match(/^#(\d+)$/);
  if (hashOnly) {
    return { id: `num-${hashOnly[1]}`, name: `#${hashOnly[1]}`, number: hashOnly[1] };
  }

  return { id: slugId(working), name: working };
}

/** Map CSV Period column: 1/2/3/OT/ot/overtime (and 1st/2nd/3rd). */
export function parsePeriodCell(raw: string | undefined | null): Period | undefined {
  if (raw == null) return undefined;
  return normalizePeriod(String(raw).trim());
}

function isGoalAgainstDetail(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    /\bgoal\s*against\b/.test(d) ||
    /\bga\b/.test(d) ||
    /^goal\b/.test(d) ||
    /\bscored\b/.test(d)
  );
}

export interface CsvImportResult {
  season: SeasonStore;
  gameId: string;
  imported: number;
  skipped: number;
}

/**
 * Import postgame CSV:
 * - SHOT + GOAL → side for (unplaced); skip SHOT if matching GOAL same period/clock/player
 * - OPP SHOT → side against; goalie from Player field; Save → save, Goal → goal_against
 * - Skip PENALTY / PERIOD SETUP / etc.
 * Locations are NOT in CSV — user places by clicking the rink.
 */
export function importGameCsv(
  season: SeasonStore,
  csvText: string,
  opts?: {
    /** Attach events to this game instead of creating a new one. */
    gameId?: string;
    gameLabel?: string;
    videoUrl?: string;
    opponent?: string;
    date?: string;
    location?: string;
  },
): CsvImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');

  const header = rows[0];
  const iPeriod = colIndex(header, 'Period');
  const iClock = colIndex(header, 'Clock');
  const iType = colIndex(header, 'Type');
  const iDetail = colIndex(header, 'Detail');
  const iPlayer = colIndex(header, 'Player / Goalie', 'Player');
  const iStrength = colIndex(header, 'Strength');
  const iVideoTs = colIndex(header, 'Video Timestamp');
  const iClipUrl = colIndex(header, 'Clip URL');

  if (iType < 0) throw new Error('CSV missing Type column');

  const existing = opts?.gameId
    ? season.games.find((g) => g.id === opts.gameId)
    : undefined;
  const gameId = existing?.id ?? uid('game');
  let next = season;
  if (!existing) {
    const opponent = opts?.opponent?.trim() || undefined;
    const date = opts?.date?.trim() || undefined;
    const location = opts?.location?.trim() || undefined;
    const fallbackLabel =
      opts?.gameLabel?.trim() ||
      `Imported game ${new Date().toLocaleDateString()}`;
    const label = composeGameLabel({
      opponent,
      date,
      location,
      label: fallbackLabel,
    });
    const game: Game = {
      id: gameId,
      label,
      opponent,
      date,
      location,
      videoUrl: opts?.videoUrl,
      createdAt: new Date().toISOString(),
    };
    next = upsertGame(season, game);
  }
  let imported = 0;
  let skipped = 0;

  type Pending = {
    type: string;
    period?: Period;
    clock?: string;
    detail: string;
    playerRaw: string;
    videoTs?: number;
    clipUrl?: string;
    strength: Strength;
  };

  const pending: Pending[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const type = (row[iType] ?? '').trim().toUpperCase();
    if (!type) {
      skipped++;
      continue;
    }
    if (type !== 'SHOT' && type !== 'GOAL' && type !== 'OPP SHOT') {
      skipped++;
      continue;
    }
    const detail = (iDetail >= 0 ? row[iDetail] : '') ?? '';
    const playerRaw = (iPlayer >= 0 ? row[iPlayer] : '') ?? '';
    const periodRaw = iPeriod >= 0 ? row[iPeriod] : '';
    const clock = iClock >= 0 ? (row[iClock] ?? '').trim() : undefined;
    const period = parsePeriodCell(periodRaw);
    const videoTs = iVideoTs >= 0 ? parseTimestampToSeconds(row[iVideoTs]) : undefined;
    const clipUrl = iClipUrl >= 0 ? (row[iClipUrl] ?? '').trim() || undefined : undefined;
    const strengthRaw = iStrength >= 0 ? row[iStrength] : '';
    // Fall back to Detail suffix • EV / PP / SH
    const strength = normalizeStrength(strengthRaw || detail);

    pending.push({
      type,
      period,
      clock,
      detail,
      playerRaw,
      videoTs,
      clipUrl,
      strength,
    });
  }

  // Dedupe: drop SHOT when a GOAL exists for same period+clock+player
  const goalKeys = new Set(
    pending
      .filter((p) => p.type === 'GOAL')
      .map((p) => `${p.period}|${p.clock}|${p.playerRaw.trim()}`),
  );

  for (const p of pending) {
    if (p.type === 'SHOT') {
      const key = `${p.period}|${p.clock}|${p.playerRaw.trim()}`;
      if (goalKeys.has(key)) {
        skipped++;
        continue;
      }
    }

    if (p.type === 'SHOT' || p.type === 'GOAL') {
      const parsed = parsePlayerField(p.playerRaw) ?? parsePlayerField(p.detail);
      if (!parsed) {
        skipped++;
        continue;
      }
      const player: Player = {
        id: parsed.id,
        name: parsed.name,
        number: parsed.number,
        role: 'skater',
      };
      next = upsertPlayer(next, player);
      const shot: ShotEvent = {
        id: uid('shot'),
        gameId,
        side: 'for',
        outcome: p.type === 'GOAL' ? 'goal' : 'miss',
        playerId: player.id,
        period: p.period,
        strength: p.strength,
        clock: p.clock,
        detail: p.detail || undefined,
        videoTimestampSec: p.videoTs,
        clipUrl: p.clipUrl,
        createdAt: new Date().toISOString(),
        kind: 'shot',
      };
      next = addShot(next, shot);
      imported++;
    } else if (p.type === 'OPP SHOT') {
      const fromPlayer = parsePlayerField(p.playerRaw);
      const fromDetail = parsePlayerField(p.detail);
      const goalieInfo = fromPlayer ?? fromDetail;
      let goalieId: string | undefined;
      if (goalieInfo) {
        const goalie: Player = {
          id: goalieInfo.id,
          name: goalieInfo.name,
          number: goalieInfo.number,
          role: 'goalie',
        };
        next = upsertPlayer(next, goalie);
        goalieId = goalie.id;
      }
      const outcome = isGoalAgainstDetail(p.detail) ? 'goal_against' : 'save';
      const shot: ShotEvent = {
        id: uid('shot'),
        gameId,
        side: 'against',
        outcome,
        goalieId,
        period: p.period,
        strength: p.strength,
        clock: p.clock,
        detail: p.detail || undefined,
        videoTimestampSec: p.videoTs,
        clipUrl: p.clipUrl,
        createdAt: new Date().toISOString(),
        kind: 'shot',
      };
      next = addShot(next, shot);
      imported++;
    }
  }

  return { season: next, gameId, imported, skipped };
}
