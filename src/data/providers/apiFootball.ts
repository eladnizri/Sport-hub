import type { CompetitionId, Match, MatchEvent, MatchStatus } from '../../lib/types';
import { COMPETITIONS } from '../competitions';

/**
 * אדפטר ל-API-Football‏ (api-sports.io).
 *
 * המפתח נקרא ממשתנה הסביבה VITE_API_FOOTBALL_KEY. שים לב: כל משתנה VITE_*
 * נארז לתוך ה-bundle של הדפדפן וגלוי למשתמש. לשימוש אישי זה בסדר; לפרסום
 * ציבורי העבר את הקריאות דרך פרוקסי בצד שרת שמחזיק את המפתח.
 */

const BASE = 'https://v3.football.api-sports.io';

interface ApiTeam { name: string; logo: string }
interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
  events?: { time: { elapsed: number }; team: { name: string }; type: string; detail: string; player: { name: string } }[];
  statistics?: { team: { name: string }; statistics: { type: string; value: number | string | null }[] }[];
}

const LIVE_CODES = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE']);
const DONE_CODES = new Set(['FT', 'AET', 'PEN']);

function mapStatus(short: string): MatchStatus {
  if (short === 'HT') return 'halftime';
  if (LIVE_CODES.has(short)) return 'live';
  if (DONE_CODES.has(short)) return 'finished';
  if (short === 'PST' || short === 'CANC' || short === 'ABD') return 'postponed';
  return 'scheduled';
}

function leagueToCompetition(leagueId: number): CompetitionId | null {
  const hit = COMPETITIONS.find((c) => c.providerId === leagueId);
  return hit ? hit.id : null;
}

function shortName(name: string): string {
  const clean = name.replace(/\b(FC|CF|AFC|SC)\b/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return clean.slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

/** צבע יציב לכל קבוצה, כדי שהסמלים לא יקפצו בין רינדורים. */
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}

function mapFixture(fx: ApiFixture, competition: CompetitionId): Match {
  const status = mapStatus(fx.fixture.status.short);
  const elapsed = fx.fixture.status.elapsed;

  const events: MatchEvent[] = (fx.events ?? [])
    .filter((e) => e.type === 'Goal' || e.type === 'Card')
    .map((e) => ({
      minute: e.time.elapsed,
      type: e.type === 'Goal' ? ('goal' as const) : ('card' as const),
      team: e.team.name === fx.teams.home.name ? ('home' as const) : ('away' as const),
      text: `${e.detail} · ${e.player?.name ?? ''}`.trim(),
    }))
    .sort((a, b) => b.minute - a.minute);

  return {
    id: `af-${fx.fixture.id}`,
    competition,
    status,
    clock: status === 'halftime' ? 'מחצית' : status === 'finished' ? 'סיום' : elapsed ? `'${elapsed}` : null,
    kickoff: fx.fixture.date,
    home: { name: fx.teams.home.name, short: shortName(fx.teams.home.name), score: fx.goals.home, accent: accentFor(fx.teams.home.name) },
    away: { name: fx.teams.away.name, short: shortName(fx.teams.away.name), score: fx.goals.away, accent: accentFor(fx.teams.away.name) },
    events,
  };
}

export function hasFootballKey(): boolean {
  return Boolean(import.meta.env.VITE_API_FOOTBALL_KEY);
}

async function call(path: string): Promise<ApiFixture[]> {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY;
  if (!key) throw new Error('missing VITE_API_FOOTBALL_KEY');

  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`api-football ${res.status}`);

  const body = (await res.json()) as { response: ApiFixture[]; errors?: unknown };
  if (Array.isArray(body.response)) return body.response;
  throw new Error('api-football: unexpected payload');
}

/** כל המשחקים החיים בליגות שבתצורה. */
export async function fetchLiveFootball(competitions: CompetitionId[]): Promise<Match[]> {
  const ids = COMPETITIONS.filter((c) => c.sport === 'football' && competitions.includes(c.id) && c.providerId)
    .map((c) => c.providerId)
    .join('-');
  if (!ids) return [];

  const rows = await call(`/fixtures?live=${ids}`);
  return rows.flatMap((fx) => {
    const comp = leagueToCompetition(fx.league.id);
    return comp ? [mapFixture(fx, comp)] : [];
  });
}

/** לוח משחקים ליום מסוים (YYYY-MM-DD), כולל משחקים שטרם החלו והסתיימו. */
export async function fetchFootballByDate(date: string, competitions: CompetitionId[]): Promise<Match[]> {
  const leagues = COMPETITIONS.filter((c) => c.sport === 'football' && competitions.includes(c.id) && c.providerId);
  const batches = await Promise.all(
    leagues.map(async (league) => {
      const season = new Date(date).getMonth() >= 6 ? new Date(date).getFullYear() : new Date(date).getFullYear() - 1;
      try {
        const rows = await call(`/fixtures?date=${date}&league=${league.providerId}&season=${season}`);
        return rows.map((fx) => mapFixture(fx, league.id));
      } catch {
        return [];
      }
    }),
  );
  return batches.flat();
}
