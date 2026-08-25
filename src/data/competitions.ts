import type { Competition, CompetitionId } from '../lib/types';

export const COMPETITIONS: Competition[] = [
  { id: 'ligat-haal', name: 'ליגת העל', short: 'ליגת העל', sport: 'football', providerId: 383, accent: '#2f7a5a' },
  { id: 'premier-league', name: 'הפרמייר ליג', short: 'פרמייר ליג', sport: 'football', providerId: 39, accent: '#4b3f9e' },
  { id: 'champions-league', name: 'ליגת האלופות', short: 'אלופות', sport: 'football', providerId: 2, accent: '#1f4f8a' },
  { id: 'europa-conference', name: 'מפעלים אירופיים (ישראליות)', short: 'אירופה', sport: 'football', providerId: 3, accent: '#c07c2c' },
  { id: 'nba', name: 'NBA', short: 'NBA', sport: 'basketball', accent: '#c0492f' },
  { id: 'euroleague', name: 'יורוליג', short: 'יורוליג', sport: 'basketball', accent: '#8a5a2b' },
];

export const COMPETITION_MAP: Record<CompetitionId, Competition> = Object.fromEntries(
  COMPETITIONS.map((c) => [c.id, c]),
) as Record<CompetitionId, Competition>;

/** Israeli clubs — used to flag European ties with local interest. */
export const ISRAELI_CLUBS = [
  'מכבי תל אביב',
  'מכבי חיפה',
  'הפועל באר שבע',
  'הפועל תל אביב',
  'בית"ר ירושלים',
  'מכבי נתניה',
  'הפועל ירושלים',
];

export function competitionName(id: CompetitionId): string {
  return COMPETITION_MAP[id]?.name ?? id;
}
