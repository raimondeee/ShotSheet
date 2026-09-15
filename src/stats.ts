import type { DefenseStats, OffenseStats, Player, SeasonStore, ShotEvent } from './types';

export function offenseStats(shots: ShotEvent[]): OffenseStats {
  const forShots = shots.filter((s) => s.side === 'for');
  const goals = forShots.filter((s) => s.outcome === 'goal').length;
  const misses = forShots.filter((s) => s.outcome === 'miss').length;
  const total = goals + misses;
  return {
    shots: total,
    goals,
    misses,
    shootingPct: total ? (goals / total) * 100 : 0,
  };
}

export function defenseStats(shots: ShotEvent[]): DefenseStats {
  const against = shots.filter((s) => s.side === 'against');
  const saves = against.filter((s) => s.outcome === 'save').length;
  const ga = against.filter((s) => s.outcome === 'goal_against').length;
  const sa = saves + ga;
  return {
    shotsAgainst: sa,
    saves,
    goalsAgainst: ga,
    savePct: sa ? (saves / sa) * 100 : 0,
  };
}

export function perPlayerOffense(
  season: SeasonStore,
  shots: ShotEvent[],
): { player: Player; stats: OffenseStats }[] {
  const map = new Map<string, ShotEvent[]>();
  for (const s of shots) {
    if (s.side !== 'for' || !s.playerId) continue;
    if (!map.has(s.playerId)) map.set(s.playerId, []);
    map.get(s.playerId)!.push(s);
  }
  const out: { player: Player; stats: OffenseStats }[] = [];
  for (const [pid, list] of map) {
    const player = season.players.find((p) => p.id === pid) ?? {
      id: pid,
      name: pid,
    };
    out.push({ player, stats: offenseStats(list) });
  }
  out.sort((a, b) => b.stats.shots - a.stats.shots);
  return out;
}

export function perGoalieDefense(
  season: SeasonStore,
  shots: ShotEvent[],
): { player: Player; stats: DefenseStats }[] {
  const map = new Map<string, ShotEvent[]>();
  for (const s of shots) {
    if (s.side !== 'against' || !s.goalieId) continue;
    if (!map.has(s.goalieId)) map.set(s.goalieId, []);
    map.get(s.goalieId)!.push(s);
  }
  const out: { player: Player; stats: DefenseStats }[] = [];
  for (const [gid, list] of map) {
    const player = season.players.find((p) => p.id === gid) ?? {
      id: gid,
      name: gid,
    };
    out.push({ player, stats: defenseStats(list) });
  }
  out.sort((a, b) => b.stats.shotsAgainst - a.stats.shotsAgainst);
  return out;
}
