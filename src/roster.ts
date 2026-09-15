import type { Player } from './types'
import { slugId } from './csv'

/** Seed roster from Robert's sample-game.csv (editable; CSV import merges). */
const SKATERS: { number: string; name: string }[] = [
  { number: '3', name: 'Carson Bader' },
  { number: '10', name: 'Kaden Lasota' },
  { number: '13', name: 'Blake Youngen' },
  { number: '14', name: 'Curtis Moyer' },
  { number: '16', name: 'Sutter Robinson' },
  { number: '18', name: 'Andrew Raimondi' },
  { number: '19', name: 'Leo Krebsbach' },
  { number: '71', name: 'Declan Rayner' },
  { number: '73', name: 'Calvin Lind' },
  { number: '77', name: 'Alex Poulin' },
  { number: '88', name: 'Boston Smith' },
  { number: '89', name: 'Dellas Potter' },
  { number: '98', name: 'Hudson Bauer' },
]

const GOALIES: { number: string; name: string }[] = [
  { number: '1', name: 'Emmett Sawchuk' },
]

function makePlayer(
  number: string,
  name: string,
  role: 'skater' | 'goalie',
): Player {
  return {
    id: slugId(`${number}-${name}`),
    name: `#${number} ${name}`,
    number,
    role,
  }
}

export const DEFAULT_ROSTER: Player[] = [
  ...SKATERS.map((s) => makePlayer(s.number, s.name, 'skater')),
  ...GOALIES.map((g) => makePlayer(g.number, g.name, 'goalie')),
]

/** Merge default roster into season players without wiping CSV/user additions. */
export function ensureDefaultRoster(players: Player[]): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  for (const def of DEFAULT_ROSTER) {
    const existing = byId.get(def.id)
    if (!existing) {
      byId.set(def.id, def)
    } else {
      // Keep user data; fill missing role/number
      byId.set(def.id, {
        ...def,
        ...existing,
        role: existing.role ?? def.role,
        number: existing.number ?? def.number,
      })
    }
  }
  // Prefer roster order first, then any extras
  const extras = [...byId.values()].filter(
    (p) => !DEFAULT_ROSTER.some((d) => d.id === p.id),
  )
  return [...DEFAULT_ROSTER.map((d) => byId.get(d.id)!), ...extras]
}
