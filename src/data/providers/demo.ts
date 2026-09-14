import type {
  CompetitionId,
  LegionnaireAppearance,
  Match,
  MatchEvent,
  Standing,
  TransferItem,
} from '../../lib/types';
import { accentFor, shortName } from '../competitions';
import { BASE_LEGIONNAIRES } from '../legionnaires';

/**
 * ספק דמו.
 *
 * מייצר לוח משחקים שנראה וזז כמו לייב אמיתי: השעות נגזרות מהיום הנוכחי,
 * הדקה מתקדמת עם השעון, והשערים נופלים בדקות קבועות-מראש לכל משחק. כך
 * אפשר לפתח ולבדוק את כל המסכים בלי מפתח API, והמעבר לספק אמיתי הוא
 * החלפה של מודול אחד בלבד.
 */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let s = hash(seed) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** מזהה קבוצה יציב לדמו, כדי שהטבלה והמשחקים ידברו באותה שפה. */
function teamId(name: string): number {
  return (hash(name) % 90000) + 10000;
}

function atHour(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface Fixture {
  id: string;
  competition: CompetitionId;
  home: [string, string, string];
  away: [string, string, string];
  /** שעה קבועה ביום, לפי השעון המקומי */
  hour?: number;
  minute?: number;
  /**
   * לחלופין: משחק מחזורי. [אורך המחזור, היסט] בדקות — הפתיחה נופלת על
   * תחילת המחזור הנוכחי, כך שהדקה מתקדמת עם השעון האמיתי והמשחק מתחיל
   * מחדש בכל מחזור. היסטים שונים פורסים את המשחקים על פני המחזור, כך
   * שתמיד יש לפחות אחד חי.
   */
  cycle?: [period: number, offset: number];
  israeliInterest?: boolean;
}

/**
 * לוח קבוע — נפרס מחדש על היום הנוכחי בכל טעינה. חלק מהמשחקים מעוגנים
 * לשעון האמיתי (offsetMinutes) כדי שתמיד יהיה משהו חי להסתכל עליו, גם
 * כשפותחים את האפליקציה באמצע הבוקר.
 */
const FIXTURES: Fixture[] = [
  { id: 'f-live-1', competition: 'premier-league', home: ['Brighton', 'BHA', '#0057b8'], away: ['Aston Villa', 'AVL', '#670e36'], cycle: [120, 0] },
  { id: 'f-live-2', competition: 'ligat-haal', home: ['Hapoel Jerusalem', 'HJ', '#c0492f'], away: ['Maccabi Netanya', 'MN', '#4b3f9e'], cycle: [120, 40], israeliInterest: true },
  { id: 'f-live-3', competition: 'champions-league', home: ['Villarreal', 'VIL', '#f5c518'], away: ['Inter', 'INT', '#0b1f6b'], cycle: [120, 80], israeliInterest: true },
  { id: 'f-live-4', competition: 'nba', home: ['Portland', 'POR', '#c0492f'], away: ['Denver', 'DEN', '#0e2240'], cycle: [170, 20], israeliInterest: true },
  { id: 'f-ha-1', competition: 'ligat-haal', home: ['Maccabi Tel Aviv', 'MTA', '#f5c518'], away: ['Hapoel Beer Sheva', 'HBS', '#c0392b'], hour: 20, minute: 15, israeliInterest: true },
  { id: 'f-ha-2', competition: 'ligat-haal', home: ['Maccabi Haifa', 'MH', '#2f7a5a'], away: ['Beitar Jerusalem', 'BJ', '#e2b13c'], hour: 18, israeliInterest: true },
  { id: 'f-ha-3', competition: 'ligat-haal', home: ['Hapoel Tel Aviv', 'HTA', '#c0492f'], away: ['Maccabi Netanya', 'MN', '#4b3f9e'], hour: 21, israeliInterest: true },
  { id: 'f-pl-1', competition: 'premier-league', home: ['Liverpool', 'LIV', '#c8102e'], away: ['Arsenal', 'ARS', '#ef0107'], hour: 19, minute: 30 },
  { id: 'f-pl-2', competition: 'premier-league', home: ['Manchester City', 'MCI', '#6cabdd'], away: ['Chelsea', 'CHE', '#034694'], hour: 17 },
  { id: 'f-pl-3', competition: 'premier-league', home: ['Tottenham', 'TOT', '#132257'], away: ['Newcastle', 'NEW', '#241f20'], hour: 14, minute: 30 },
  { id: 'f-ucl-1', competition: 'champions-league', home: ['Real Madrid', 'RMA', '#1f4f8a'], away: ['Bayern Munich', 'BAY', '#dc052d'], hour: 22 },
  { id: 'f-ucl-2', competition: 'champions-league', home: ['Benfica', 'BEN', '#e30613'], away: ['Borussia Dortmund', 'DOR', '#fde100'], hour: 22 },
  { id: 'f-uec-1', competition: 'conference-league', home: ['Slavia Praha', 'SLA', '#8b1e2d'], away: ['Maccabi Tel Aviv', 'MTA', '#f5c518'], hour: 21, minute: 45, israeliInterest: true },
  { id: 'f-uec-2', competition: 'conference-league', home: ['AEK Athens', 'AEK', '#f2c200'], away: ['Rangers', 'RAN', '#1c458f'], hour: 19, minute: 45, israeliInterest: true },
  { id: 'f-nba-1', competition: 'nba', home: ['New York', 'NYK', '#f58426'], away: ['Philadelphia', 'PHI', '#006bb6'], hour: 4, minute: 30 },
  { id: 'f-nba-2', competition: 'nba', home: ['Boston', 'BOS', '#007a33'], away: ['Miami', 'MIA', '#98002e'], hour: 2, minute: 30 },
  { id: 'f-nba-3', competition: 'nba', home: ['LA Lakers', 'LAL', '#552583'], away: ['Golden State', 'GSW', '#1d428a'], hour: 5 },
];

const DEMO_SCORERS = [
  'ערן זהבי', 'דור פרץ', 'מנור סולומון', 'אוסקר גלוך', 'מוחמד אבו פאני',
  'שון גולדברג', 'דולב חזיזה', 'עומר אצילי', 'ליאל אבדה', 'סתיו למקין',
];

/** מבקיע יציב לכל שער, כדי שהסיכום לא ישנה שמות בכל רענון. */
function scorerFor(seed: string, minute: number): string {
  return DEMO_SCORERS[hash(`${seed}:${minute}`) % DEMO_SCORERS.length];
}

const FOOTBALL_LENGTH = 96; // כולל תוספת זמן
const BASKET_LENGTH = 130; // 48 דקות משחק שנמתחות על ~2:10 שעון אמיתי

function goalMinutes(seed: string, count: number): number[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => Math.floor(r() * 90) + 1).sort((a, b) => a - b);
}

function buildFootball(fx: Fixture, now: Date, kickoff: Date): Match {
  const elapsedMs = now.getTime() - kickoff.getTime();
  const elapsed = Math.floor(elapsedMs / 60000);
  const r = rng(fx.id);
  const homeGoals = goalMinutes(fx.id + ':h', Math.floor(r() * 3.4));
  const awayGoals = goalMinutes(fx.id + ':a', Math.floor(r() * 3.1));

  let status: Match['status'] = 'scheduled';
  let clock: string | null = null;
  let visible = 0;

  if (elapsed >= FOOTBALL_LENGTH) {
    status = 'finished';
    clock = 'סיום';
    visible = 90;
  } else if (elapsed >= 48 && elapsed < 53) {
    status = 'halftime';
    clock = 'מחצית';
    visible = 45;
  } else if (elapsed >= 0) {
    status = 'live';
    visible = elapsed < 48 ? Math.min(elapsed + 1, 45) : Math.min(elapsed - 2, 90);
    clock = `'${visible}`;
  }

  const homeScore = status === 'scheduled' ? null : homeGoals.filter((m) => m <= visible).length;
  const awayScore = status === 'scheduled' ? null : awayGoals.filter((m) => m <= visible).length;

  const events: MatchEvent[] = [
    // הפורמט מחקה את הספק: "סוג השער · שם השחקן", כי מנוע הסיכומים
    // מחלץ את שם המבקיע מהחלק שאחרי המפריד.
    ...homeGoals.filter((m) => m <= visible).map<MatchEvent>((m) => ({ minute: m, type: 'goal', team: 'home', text: `שער · ${scorerFor(fx.id + ':h', m)}` })),
    ...awayGoals.filter((m) => m <= visible).map<MatchEvent>((m) => ({ minute: m, type: 'goal', team: 'away', text: `שער · ${scorerFor(fx.id + ':a', m)}` })),
  ].sort((a, b) => b.minute - a.minute);

  const possession = 38 + Math.floor(r() * 24);

  return {
    id: fx.id,
    competition: fx.competition,
    status,
    clock,
    kickoff: kickoff.toISOString(),
    home: { name: fx.home[0], short: fx.home[1], accent: fx.home[2], score: homeScore, providerId: teamId(fx.home[0]) },
    away: { name: fx.away[0], short: fx.away[1], accent: fx.away[2], score: awayScore, providerId: teamId(fx.away[0]) },
    israeliInterest: fx.israeliInterest,
    events,
    stats:
      status === 'scheduled'
        ? undefined
        : [
            { label: 'אחזקה', home: possession, away: 100 - possession },
            { label: 'בעיטות למסגרת', home: 2 + Math.floor(r() * 6), away: 1 + Math.floor(r() * 6) },
            { label: 'קרנות', home: 1 + Math.floor(r() * 8), away: 1 + Math.floor(r() * 8) },
          ],
  };
}

function buildBasket(fx: Fixture, now: Date, tip: Date): Match {
  const elapsed = Math.floor((now.getTime() - tip.getTime()) / 60000);
  const r = rng(fx.id);
  const homePace = 2.05 + r() * 0.35;
  const awayPace = 2.05 + r() * 0.35;

  let status: Match['status'] = 'scheduled';
  let clock: string | null = null;
  let played = 0;

  if (elapsed >= BASKET_LENGTH) {
    status = 'finished';
    clock = 'סיום';
    played = 48;
  } else if (elapsed >= 0) {
    status = 'live';
    played = Math.min(48, (elapsed / BASKET_LENGTH) * 48);
    const quarter = Math.min(4, Math.floor(played / 12) + 1);
    const left = 12 - (played % 12);
    clock = `רבע ${quarter} · ${Math.floor(left)}:${String(Math.floor((left % 1) * 60)).padStart(2, '0')}`;
  }

  const homeScore = status === 'scheduled' ? null : Math.round(played * homePace);
  const awayScore = status === 'scheduled' ? null : Math.round(played * awayPace);

  return {
    id: fx.id,
    competition: fx.competition,
    status,
    clock,
    kickoff: tip.toISOString(),
    home: { name: fx.home[0], short: fx.home[1], accent: fx.home[2], score: homeScore, providerId: teamId(fx.home[0]) },
    away: { name: fx.away[0], short: fx.away[1], accent: fx.away[2], score: awayScore, providerId: teamId(fx.away[0]) },
    israeliInterest: fx.israeliInterest,
    events: [],
    stats:
      status === 'scheduled'
        ? undefined
        : [
            { label: 'אחוזי שדה', home: 42 + Math.floor(r() * 12), away: 42 + Math.floor(r() * 12) },
            { label: 'ריבאונדים', home: Math.round(played * 0.85), away: Math.round(played * 0.9) },
            { label: 'אסיסטים', home: Math.round(played * 0.5), away: Math.round(played * 0.52) },
          ],
  };
}

function kickoffFor(fx: Fixture, now: Date): Date {
  if (!fx.cycle) return atHour(now, fx.hour ?? 20, fx.minute ?? 0);
  const [period, offset] = fx.cycle;
  const minutesNow = Math.floor(now.getTime() / 60000);
  const start = Math.floor((minutesNow - offset) / period) * period + offset;
  return new Date(start * 60000);
}

export function demoMatches(now = new Date()): Match[] {
  return FIXTURES.map((fx) => {
    const kickoff = kickoffFor(fx, now);
    return fx.competition === 'nba'
      ? buildBasket(fx, now, kickoff)
      : buildFootball(fx, now, kickoff);
  }).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

const OPPONENTS = ['Real Betis', 'Sporting', 'Ajax', 'Lyon', 'Roma', 'Sevilla', 'PSV', 'Celtic'];

/**
 * השוואת שמות מועדונים סלחנית: הספקים מחזירים "Portland Trail Blazers"
 * במקום שבו הרשימה שלנו כותבת "Portland", ולהיפך.
 */
function sameClub(a: string, b: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * היסטוריית הופעות סינתטית ללגיונרים.
 *
 * מחזירה את אותו מבנה שהקאש האמיתי מחזיק, כך שמסך הלגיונרים ומנוע
 * התיק (src/lib/dossier.ts) רצים על נתוני דמו ועל נתונים אמיתיים באותו
 * קוד בדיוק. לכל שחקן נגזרת מגמה יציבה מה-id שלו, כדי שהמסך יראה
 * עולים ויורדים אמיתיים ולא רעש אקראי.
 */
export function demoAppearances(
  now = new Date(),
  matches = demoMatches(now),
): Record<string, LegionnaireAppearance[]> {
  const out: Record<string, LegionnaireAppearance[]> = {};

  for (const player of BASE_LEGIONNAIRES) {
    const r = rng(player.id);
    // כיוון המגמה נקבע פעם אחת לשחקן: עולה, יציב או יורד
    const direction = r() < 0.34 ? 1 : r() < 0.6 ? 0 : -1;
    const maxMinutes = player.sport === 'basketball' ? 34 : 90;

    const rows: LegionnaireAppearance[] = [];
    for (let back = 0; back < 6; back++) {
      const date = new Date(now.getTime() - back * 6.5 * 24 * 3600 * 1000);
      const rr = rng(`${player.id}:${back}`);

      // back=0 הוא המשחק האחרון; המגמה נמדדת ממנו אחורה
      const lean = direction * (2 - Math.min(back, 4)) * 0.12;
      const share = Math.max(0, Math.min(1, 0.55 + lean + (rr() - 0.5) * 0.3));
      const minutes = share < 0.12 ? 0 : Math.round(maxMinutes * share);
      const started = minutes >= maxMinutes * 0.7;

      const goals = minutes > 20 && rr() < 0.26 ? 1 : 0;
      const assists = minutes > 20 && rr() < 0.2 ? 1 : 0;

      const todays = back === 0
        ? matches.find((m) => sameClub(m.home.name, player.club) || sameClub(m.away.name, player.club))
        : undefined;
      const opponent = todays
        ? sameClub(todays.home.name, player.club) ? todays.away.name : todays.home.name
        : OPPONENTS[Math.floor(rr() * OPPONENTS.length)];

      rows.push({
        fixtureId: todays?.id ?? `demo-${player.id}-${back}`,
        date: (todays ? new Date(todays.kickoff) : date).toISOString(),
        opponent,
        away: back % 2 === 1,
        started,
        minutes,
        goals,
        assists,
        rating: minutes ? Math.round((6 + goals * 1.1 + assists * 0.7 + rr() * 1.2) * 10) / 10 : null,
        ...(player.sport === 'basketball'
          ? {
              points: minutes ? Math.round(minutes * (0.35 + rr() * 0.35)) : 0,
              rebounds: minutes ? Math.round(minutes * 0.22) : 0,
            }
          : {}),
      });
    }

    out[player.id] = rows;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* טבלאות דמו                                                          */
/* ------------------------------------------------------------------ */

const TABLE_TEAMS: Record<string, string[]> = {
  'ligat-haal': [
    'Maccabi Tel Aviv', 'Maccabi Haifa', 'Hapoel Beer Sheva', 'Beitar Jerusalem',
    'Hapoel Tel Aviv', 'Maccabi Netanya', 'Hapoel Jerusalem', 'Bnei Sakhnin',
    'Hapoel Haifa', 'Ironi Kiryat Shmona', 'Ashdod', 'Maccabi Bnei Raina',
  ],
  'premier-league': [
    'Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Newcastle',
    'Aston Villa', 'Tottenham', 'Brighton', 'Manchester United', 'West Ham',
  ],
  'champions-league': [
    'Real Madrid', 'Bayern Munich', 'Inter', 'Liverpool', 'Barcelona',
    'Arsenal', 'Borussia Dortmund', 'Villarreal',
  ],
  'europa-league': ['Roma', 'Ajax', 'Porto', 'Rangers', 'Lyon', 'Real Betis'],
  'conference-league': [
    'Slavia Praha', 'AEK Athens', 'Maccabi Tel Aviv', 'Fiorentina', 'Celtic', 'PSV',
  ],
};

/**
 * טבלאות דמו יציבות. הנקודות נגזרות מה-id של הקבוצה ולא מהשעון, כדי
 * שהטבלה לא תקפוץ בכל רענון — ואז המשחקים החיים מוחלים עליה במסך
 * ומייצרים תנועה אמיתית.
 */
export function demoStandings(): Standing[] {
  const out: Standing[] = [];

  for (const [competition, teams] of Object.entries(TABLE_TEAMS)) {
    const rows = teams.map((team) => {
      const r = rng(`table:${competition}:${team}`);
      const played = competition === 'ligat-haal' || competition === 'premier-league' ? 12 : 5;
      const won = Math.floor(r() * (played + 1));
      const drawn = Math.floor(r() * (played - won + 1));
      const lost = played - won - drawn;
      const goalsFor = won * 2 + drawn + Math.floor(r() * 5);
      const goalsAgainst = lost * 2 + drawn + Math.floor(r() * 4);
      const form = Array.from({ length: 5 }, () => (r() < 0.45 ? 'W' : r() < 0.7 ? 'D' : 'L')).join('');

      return {
        competition: competition as CompetitionId,
        rank: 0,
        teamId: teamId(team),
        team,
        short: shortName(team),
        accent: accentFor(team),
        played, won, drawn, lost, goalsFor, goalsAgainst,
        points: won * 3 + drawn,
        form,
        group: null,
        marker: null as string | null,
      } satisfies Standing;
    });

    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor,
    );
    rows.forEach((row, i) => {
      row.rank = i + 1;
      row.marker = markerFor(competition as CompetitionId, i + 1, rows.length);
    });
    out.push(...rows);
  }

  return out;
}

function markerFor(competition: CompetitionId, rank: number, total: number): string | null {
  if (competition === 'champions-league') {
    if (rank <= 2) return 'שמינית הגמר';
    if (rank <= 6) return 'פלייאוף';
    return null;
  }
  if (competition === 'europa-league' || competition === 'conference-league') {
    return rank <= 2 ? 'העפלה' : rank <= 4 ? 'פלייאוף' : null;
  }
  if (rank === 1) return 'אליפות';
  if (rank <= 3) return 'אירופה';
  if (rank > total - 2) return 'מאבק הישרדות';
  return null;
}

const TRANSFERS: Omit<TransferItem, 'publishedAt'>[] = [
  {
    id: 't-1', player: 'מנור סולומון', sport: 'football', fromClub: 'Tottenham', toClub: 'Villarreal',
    stage: 'done', reliability: 5, source: 'Fabrizio Romano', fee: '€8.5M',
    summary: 'המעבר הושלם, חוזה לשלוש שנים עם אופציה לשנה נוספת.',
    competitions: ['champions-league'],
  },
  {
    id: 't-2', player: 'אוסקר גלוך', sport: 'football', fromClub: 'RB Salzburg', toClub: 'Brighton',
    stage: 'talks', reliability: 4, source: 'Sky Sport', fee: '€22M (מדווח)',
    summary: 'המועדונים החליפו טיוטות. הפער בסעיף הבונוסים עדיין פתוח.',
    competitions: ['premier-league', 'champions-league'],
  },
  {
    id: 't-3', player: 'דור תורג׳מן', sport: 'football', fromClub: 'מכבי תל אביב', toClub: 'Feyenoord',
    stage: 'rumor', reliability: 2, source: 'ONE', fee: null,
    summary: 'סקאוטים הולנדים נכחו בשני משחקי ליגה אחרונים. אין הצעה רשמית.',
    competitions: ['ligat-haal', 'champions-league'],
  },
  {
    id: 't-4', player: 'דני אבדיה', sport: 'basketball', fromClub: 'Portland Trail Blazers', toClub: 'יעד לא ידוע',
    stage: 'rumor', reliability: 3, source: 'The Athletic', fee: null,
    summary: 'שלוש קבוצות מזרח בדקו זמינות לקראת דדליין ההעברות.',
    competitions: ['nba'],
  },
  {
    id: 't-5', player: 'אנאן ח׳לאילי', sport: 'football', fromClub: 'Slavia Prague', toClub: 'Bologna',
    stage: 'agreed', reliability: 4, source: 'Di Marzio', fee: '€6M + 15%',
    summary: 'הסכמה עקרונית בין המועדונים, נותרו בדיקות רפואיות.',
    competitions: ['conference-league'],
  },
  {
    id: 't-6', player: 'ליאל אבדה', sport: 'football', fromClub: 'Charlotte FC', toClub: 'מכבי תל אביב',
    stage: 'talks', reliability: 3, source: 'ספורט 5', fee: 'השאלה עם אופציה',
    summary: 'בחינת חזרה לישראל בחלון החורף, תלוי בשחרור שכר.',
    competitions: ['ligat-haal'],
  },
  {
    id: 't-7', player: 'ג׳ורדן מקריי', sport: 'basketball', fromClub: 'NBA G-League', toClub: 'Panathinaikos',
    stage: 'done', reliability: 5, source: 'EuroHoops', fee: 'עד סוף העונה',
    summary: 'החתמה מיידית לקראת סבב המשחקים הכפול ביורוליג.',
    competitions: ['europa-league'],
  },
  {
    id: 't-8', player: 'דור פרץ', sport: 'football', fromClub: 'AEK Athens', toClub: 'Trabzonspor',
    stage: 'rumor', reliability: 2, source: 'Fanatik', fee: null,
    summary: 'דיווח טורקי על בדיקה מוקדמת. מקורות בסביבת השחקן מכחישים.',
    competitions: ['conference-league'],
  },
];

export function demoTransfers(now = new Date()): TransferItem[] {
  return TRANSFERS.map((t, i) => ({
    ...t,
    publishedAt: new Date(now.getTime() - (i * 47 + 9) * 60000).toISOString(),
  }));
}
