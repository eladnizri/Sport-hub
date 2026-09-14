import type { CompetitionId, Match, MatchEvent, MatchStatus, Standing } from '../../lib/types';
import {
  COMPETITIONS,
  accentFor,
  competitionForProviderId,
  isIsraeliClub,
  shortName,
} from '../competitions';

/**
 * אדפטר ל-API-Football‏ (api-sports.io).
 *
 * בארכיטקטורה הנוכחית רוב הנתונים מגיעים מהקאש הסטטי שה-Action בונה,
 * והאדפטר הזה משמש בדפדפן רק לרענון חי של משחקים שסומנו כשלך. המפתח
 * נקרא מ-VITE_API_FOOTBALL_KEY; כל משתנה VITE_* נארז ל-bundle וגלוי
 * למי שפותח את הקוד, ולכן השאר אותו ריק אם האתר ציבורי — הקאש לבדו
 * מספיק, ורק העדכון החי בזמן משחק יאבד.
 */

const BASE = 'https://v3.football.api-sports.io';

interface ApiTeam { id: number; name: string; logo: string }
interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
  events?: { time: { elapsed: number }; team: { name: string }; type: string; detail: string; player: { name: string } }[];
  statistics?: { team: { name: string }; statistics: { type: string; value: number | string | null }[] }[];
}

const LIVE_CODES = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE_CODES = new Set(['FT', 'AET', 'PEN']);

export function mapStatus(short: string): MatchStatus {
  if (short === 'HT') return 'halftime';
  if (LIVE_CODES.has(short)) return 'live';
  if (DONE_CODES.has(short)) return 'finished';
  if (short === 'PST' || short === 'CANC' || short === 'ABD' || short === 'SUSP') return 'postponed';
  return 'scheduled';
}

export function mapFixture(fx: ApiFixture, competition: CompetitionId): Match {
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
    home: {
      name: fx.teams.home.name,
      short: shortName(fx.teams.home.name),
      score: fx.goals.home,
      accent: accentFor(fx.teams.home.name),
      providerId: fx.teams.home.id,
    },
    away: {
      name: fx.teams.away.name,
      short: shortName(fx.teams.away.name),
      score: fx.goals.away,
      accent: accentFor(fx.teams.away.name),
      providerId: fx.teams.away.id,
    },
    israeliInterest: isIsraeliClub(fx.teams.home.name) || isIsraeliClub(fx.teams.away.name),
    events,
  };
}

export function hasFootballKey(): boolean {
  return Boolean(import.meta.env.VITE_API_FOOTBALL_KEY);
}

async function call<T>(path: string): Promise<T[]> {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY;
  if (!key) throw new Error('missing VITE_API_FOOTBALL_KEY');

  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`api-football ${res.status}`);

  const body = (await res.json()) as { response: T[] };
  if (Array.isArray(body.response)) return body.response;
  throw new Error('api-football: unexpected payload');
}

/** מזהי הליגות אצל הספק עבור התחרויות שנבחרו. */
function providerIdsFor(competitions: CompetitionId[]): number[] {
  return COMPETITIONS.filter((c) => c.sport === 'football' && competitions.includes(c.id))
    .flatMap((c) => c.providerIds ?? []);
}

/**
 * רענון חי לקבוצת ליגות. שורפת קריאה אחת בלבד, ולכן נקראת רק כשיש
 * באמת משחק שמעניין אותך על המסך.
 */
export async function fetchLiveFootball(competitions: CompetitionId[]): Promise<Match[]> {
  const ids = providerIdsFor(competitions);
  if (!ids.length) return [];

  const rows = await call<ApiFixture>(`/fixtures?live=${ids.join('-')}`);
  return rows.flatMap((fx) => {
    const comp = competitionForProviderId(fx.league.id);
    return comp ? [mapFixture(fx, comp)] : [];
  });
}

/** משחק בודד, כולל אירועים — לרענון מסך המשחק. */
export async function fetchFixture(fixtureId: string): Promise<Match | null> {
  const raw = fixtureId.replace(/^af-/, '');
  const rows = await call<ApiFixture>(`/fixtures?id=${raw}`);
  const fx = rows[0];
  if (!fx) return null;
  const comp = competitionForProviderId(fx.league.id);
  return comp ? mapFixture(fx, comp) : null;
}

/** לוח משחקים ליום מסוים (YYYY-MM-DD). */
export async function fetchFootballByDate(date: string, competitions: CompetitionId[]): Promise<Match[]> {
  const day = new Date(date);
  // עונת כדורגל אירופית נפתחת באוגוסט ונחתמת במאי, ולכן חודשים ינואר-יוני
  // שייכים לעונה שנפתחה בשנה הקודמת.
  const season = day.getMonth() >= 6 ? day.getFullYear() : day.getFullYear() - 1;

  const batches = await Promise.all(
    providerIdsFor(competitions).map(async (leagueId) => {
      const comp = competitionForProviderId(leagueId);
      if (!comp) return [];
      try {
        const rows = await call<ApiFixture>(`/fixtures?date=${date}&league=${leagueId}&season=${season}`);
        return rows.map((fx) => mapFixture(fx, comp));
      } catch {
        // ליגה בודדת שנכשלת לא מפילה את שאר הלוח
        return [];
      }
    }),
  );
  return batches.flat();
}

/* ------------------------------------------------------------------ */
/* טבלאות                                                              */
/* ------------------------------------------------------------------ */

interface ApiStandingRow {
  rank: number;
  team: ApiTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  description: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

interface ApiStandingsPayload {
  league: { id: number; standings: ApiStandingRow[][] };
}

export function mapStandingRow(row: ApiStandingRow, competition: CompetitionId): Standing {
  return {
    competition,
    rank: row.rank,
    teamId: row.team.id,
    team: row.team.name,
    short: shortName(row.team.name),
    accent: accentFor(row.team.name),
    played: row.all.played,
    won: row.all.win,
    drawn: row.all.draw,
    lost: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    points: row.points,
    form: row.form,
    group: row.group,
    marker: row.description,
  };
}

export async function fetchStandings(competition: CompetitionId, season: number): Promise<Standing[]> {
  const leagueId = COMPETITIONS.find((c) => c.id === competition)?.providerIds?.[0];
  if (!leagueId) return [];

  const rows = await call<ApiStandingsPayload>(`/standings?league=${leagueId}&season=${season}`);
  const groups = rows[0]?.league.standings ?? [];
  return groups.flat().map((row) => mapStandingRow(row, competition));
}
