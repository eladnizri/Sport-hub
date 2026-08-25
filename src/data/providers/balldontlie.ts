import type { Match, MatchStatus } from '../../lib/types';

/**
 * אדפטר ל-balldontlie‏ (NBA).
 *
 * המפתח נקרא מ-VITE_BALLDONTLIE_KEY. השכבה החינמית מחזירה לוח משחקים
 * ותוצאות סופיות; תוצאות חיות ותצוגת שעון דורשות מנוי בתשלום — במקרה כזה
 * המשחק יוצג כ"מתוכנן" עד שהתוצאה מתעדכנת.
 */

const BASE = 'https://api.balldontlie.io/v1';

interface BdlTeam { id: number; full_name: string; abbreviation: string }
interface BdlGame {
  id: number;
  date: string;
  status: string;
  period: number;
  time: string | null;
  home_team: BdlTeam;
  visitor_team: BdlTeam;
  home_team_score: number;
  visitor_team_score: number;
}

const TEAM_COLORS: Record<string, string> = {
  BOS: '#007a33', LAL: '#552583', GSW: '#1d428a', POR: '#c0492f', DEN: '#0e2240',
  MIA: '#98002e', NYK: '#f58426', PHI: '#006bb6', MIL: '#00471b', DAL: '#00538c',
};

function accentFor(abbr: string): string {
  if (TEAM_COLORS[abbr]) return TEAM_COLORS[abbr];
  let h = 0;
  for (let i = 0; i < abbr.length; i++) h = (h * 37 + abbr.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 40%)`;
}

function mapStatus(game: BdlGame): MatchStatus {
  const s = game.status.toLowerCase();
  if (s === 'final') return 'finished';
  if (s.includes('qtr') || s.includes('half') || s === 'in progress' || game.period > 0) return 'live';
  return 'scheduled';
}

export function hasNbaKey(): boolean {
  return Boolean(import.meta.env.VITE_BALLDONTLIE_KEY);
}

function mapGame(game: BdlGame): Match {
  const status = mapStatus(game);
  const scored = status !== 'scheduled';
  return {
    id: `bdl-${game.id}`,
    competition: 'nba',
    status,
    clock: status === 'finished' ? 'סיום' : status === 'live' ? `רבע ${game.period}${game.time ? ` · ${game.time}` : ''}` : null,
    kickoff: game.date,
    home: {
      name: game.home_team.full_name,
      short: game.home_team.abbreviation,
      score: scored ? game.home_team_score : null,
      accent: accentFor(game.home_team.abbreviation),
    },
    away: {
      name: game.visitor_team.full_name,
      short: game.visitor_team.abbreviation,
      score: scored ? game.visitor_team_score : null,
      accent: accentFor(game.visitor_team.abbreviation),
    },
    events: [],
  };
}

export async function fetchNbaByDate(date: string): Promise<Match[]> {
  const key = import.meta.env.VITE_BALLDONTLIE_KEY;
  if (!key) throw new Error('missing VITE_BALLDONTLIE_KEY');

  const res = await fetch(`${BASE}/games?dates[]=${date}&per_page=100`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(`balldontlie ${res.status}`);

  const body = (await res.json()) as { data: BdlGame[] };
  return (body.data ?? []).map(mapGame);
}
