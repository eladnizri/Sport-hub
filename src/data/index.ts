import type {
  CompetitionId,
  FeedResult,
  FeedSource,
  Legionnaire,
  LegionnaireAppearance,
  LegionnaireDossier,
  Match,
  NewsItem,
  Standing,
  TeamStatus,
  TransferItem,
} from '../lib/types';
import { buildDossier, playsIn, sortDossiers } from '../lib/dossier';
import { circleRoster } from '../lib/circle';
import { narrativeFor, templateNarrative } from '../lib/narrative';
import { buildScenarios, buildTable, gapSentence, rowForTeam } from '../lib/table';
import { buildNews } from '../lib/news';
import { clubNamesMatch, displayName } from './competitions';
import { BASE_LEGIONNAIRES, mergeLegionnaires } from './legionnaires';
import { demoAppearances, demoMatches, demoStandings, demoTransfers } from './providers/demo';
import { loadSnapshot, type Snapshot } from './providers/cache';

/**
 * שכבת הנתונים היחידה שהמסכים מדברים איתה.
 *
 * זו אפליקציית סקירה, לא מעקב חי: המקור היחיד הוא הקאש הסטטי שה-Action
 * בונה כמה פעמים ביום (ראה scripts/build-cache.mjs), ואם הוא לא זמין
 * עדיין — ספק דמו. אין קריאה חוזרת לספק מהדפדפן בשום מסך. המקור
 * שבו השתמשנו בפועל מוחזר בכל תוצאה ומוצג במסך.
 */

export interface LegionnairePrefs {
  custom: Legionnaire[];
  hiddenIds: string[];
}

const NO_CUSTOM: LegionnairePrefs = { custom: [], hiddenIds: [] };

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** גיבוי דמו מלא, בצורת snapshot — כך שכל שאר הקוד לא צריך להבדיל. */
function demoSnapshot(now: Date): Snapshot {
  const matches = demoMatches(now);
  return {
    builtAt: now.toISOString(),
    matches,
    standings: demoStandings(),
    appearances: demoAppearances(now, matches),
    legionnaires: [],
    transfers: demoTransfers(now),
  };
}

async function resolveSnapshot(now: Date): Promise<{ snapshot: Snapshot; source: FeedSource }> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return { snapshot: demoSnapshot(now), source: 'demo' };
  return { snapshot, source: 'cache' };
}

/** משחק שהסתיים ואין לו עדיין סיכום אפוי מקבל תבנית, בלי לגעת בקאש. */
function withNarrative(match: Match, standings: Standing[], matches: Match[]): Match {
  if (match.narrative || match.status !== 'finished') return match;
  const table = buildTable(standings, matches, match.competition);
  return { ...match, narrative: templateNarrative(match, table) ?? undefined };
}

export interface MatchQuery {
  competitions: CompetitionId[];
  date?: Date;
}

/**
 * לוח המשחקים להצגה: רק תחרויות שבחרת, ורק היום.
 */
export async function getMatches({ competitions, date = new Date() }: MatchQuery): Promise<FeedResult<Match>> {
  const { snapshot, source } = await resolveSnapshot(date);

  const items = snapshot.matches
    .filter((m) => competitions.includes(m.competition))
    .filter((m) => isToday(m.kickoff, date))
    .map((m) => withNarrative(m, snapshot.standings, snapshot.matches))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  return { items, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt };
}

/** הטבלאות הגולמיות, כפי שהספק מחזיר אותן (לפני משחקי היום). */
export async function getStandings(date = new Date()): Promise<FeedResult<Standing>> {
  const { snapshot, source } = await resolveSnapshot(date);
  return { items: snapshot.standings, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt };
}

/**
 * הטבלה של תחרות אחת, אחרי החלת משחקי היום, יחד עם לוח המשחקים
 * שבנה אותה — המסך צריך את שניהם ואין טעם לטעון את הקאש פעמיים.
 */
export async function getTableView(
  competitions: CompetitionId[],
  date = new Date(),
): Promise<FeedResult<Standing> & { matches: Match[] }> {
  const { snapshot, source } = await resolveSnapshot(date);
  return {
    items: snapshot.standings.filter((s) => competitions.includes(s.competition)),
    matches: snapshot.matches,
    source,
    fetchedAt: new Date().toISOString(),
    builtAt: snapshot.builtAt,
  };
}

export interface LegionQuery {
  prefs?: LegionnairePrefs;
  date?: Date;
}

/** רשימת הלגיונרים אחרי מיזוג שלוש השכבות. */
export async function getLegionnaireList(prefs: LegionnairePrefs = NO_CUSTOM): Promise<Legionnaire[]> {
  const snapshot = await loadSnapshot();
  return mergeLegionnaires(BASE_LEGIONNAIRES, snapshot?.legionnaires ?? [], prefs.custom, prefs.hiddenIds);
}

export async function getLegionnaires({
  prefs = NO_CUSTOM,
  date = new Date(),
}: LegionQuery = {}): Promise<FeedResult<LegionnaireDossier>> {
  const players = await getLegionnaireList(prefs);
  const { snapshot, source } = await resolveSnapshot(date);

  const appearances: Record<string, LegionnaireAppearance[]> = snapshot.appearances ?? {};

  const items = sortDossiers(
    players.map((player) =>
      buildDossier({ player, history: appearances[player.id] ?? [], matches: snapshot.matches, now: date }),
    ),
  );

  return { items, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt };
}

export async function getTransfers(date = new Date()): Promise<FeedResult<TransferItem>> {
  const snapshot = await loadSnapshot();
  const items = snapshot?.transfers?.length ? snapshot.transfers : demoTransfers(date);
  return {
    items,
    // אין ספק העברות ציבורי אמין, ולכן הרדאר נשען על פיד עריכתי. עד
    // שיחובר כזה, התוכן מסומן כדמו ולא מתחזה לדיווח אמיתי.
    source: snapshot?.transfers?.length ? 'cache' : 'demo',
    fetchedAt: new Date().toISOString(),
    builtAt: snapshot?.builtAt,
  };
}

export interface CirclePrefs {
  legionnaires: LegionnairePrefs;
  followedTeams: string[];
  hiddenTeams: string[];
}

/**
 * פיד הסקירה: סיכומים שנבנים מהנתונים (תוצאות, תנועת טבלה, העברות)
 * וכותרות אמיתיות מ-RSS אם קיימות בקאש, ממוזגים וממוינים לפי זמן,
 * מסוננים למעגל המעקב שלך.
 */
export async function getNews(circle: CirclePrefs, date = new Date()): Promise<FeedResult<NewsItem>> {
  const legionnaires = await getLegionnaireList(circle.legionnaires);
  const { snapshot, source } = await resolveSnapshot(date);

  const items = buildNews({
    matches: snapshot.matches,
    standings: snapshot.standings,
    transfers: snapshot.transfers ?? [],
    headlines: snapshot.news ?? [],
    legionnaires,
    followedTeams: circle.followedTeams,
    hiddenTeams: circle.hiddenTeams,
    now: date,
  });

  return { items, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt };
}

/**
 * כרטיס "מה קורה" לכל קבוצה במעגל שלך: מיקום בטבלה, תוצאה אחרונה,
 * המשחק הבא, ותרחיש להיום אם יש. קבוצה בלי טבלה זמינה (למשל שלב
 * נוקאאוט) עדיין מקבלת כרטיס עם תוצאה ומשחק הבא בלבד.
 */
export async function getTeamStatuses(circle: CirclePrefs, date = new Date()): Promise<FeedResult<TeamStatus>> {
  const legionnaires = await getLegionnaireList(circle.legionnaires);
  const { snapshot, source } = await resolveSnapshot(date);

  const roster = circleRoster(legionnaires, circle.followedTeams, circle.hiddenTeams);

  const items: TeamStatus[] = roster.map((team) => buildTeamStatus(team, snapshot, legionnaires, date)).filter((t): t is TeamStatus => t !== null);

  return { items, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt };
}

function buildTeamStatus(
  team: string,
  snapshot: Snapshot,
  legionnaires: Legionnaire[],
  now: Date,
): TeamStatus | null {
  // מוצאים משחק כלשהו של הקבוצה כדי לדעת תחרות/צבע/מזהה — בלי זה אין לנו הקשר
  const anyMatch = snapshot.matches.find((m) => playsInName(team, m));
  const legionnaire = legionnaires.find((p) => p.club && clubNamesMatch(p.club, team));
  const competition = anyMatch?.competition ?? legionnaire?.competition;
  if (!competition) return null;

  const side = anyMatch ? (playsInName(team, anyMatch) === 'home' ? anyMatch.home : anyMatch.away) : null;

  const rows = buildTable(snapshot.standings, snapshot.matches, competition, now);
  const row = rowForTeam(rows, team, side?.providerId);

  const past = snapshot.matches
    .filter((m) => m.status === 'finished' && playsInName(team, m))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))[0];

  const upcoming = snapshot.matches
    .filter((m) => m.status === 'scheduled' && playsInName(team, m) && new Date(m.kickoff) > now)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];

  const scenario = row
    ? buildScenarios(rows, competition, 99).find((s) => s.teamId === row.teamId) ?? null
    : null;

  const dossier = legionnaire
    ? buildDossier({
        player: legionnaire,
        history: snapshot.appearances?.[legionnaire.id] ?? [],
        matches: snapshot.matches,
        now,
      })
    : null;

  return {
    team,
    short: side?.short ?? row?.short ?? team.slice(0, 3),
    accent: side?.accent ?? row?.accent ?? '#666',
    teamId: side?.providerId ?? row?.teamId,
    competition,
    table: row ? { ...row, gapText: gapSentence(rows, row.teamId) } : null,
    lastResult: past
      ? {
          opponent: displayName(playsInName(team, past) === 'home' ? past.away.name : past.home.name),
          scoreFor: (playsInName(team, past) === 'home' ? past.home.score : past.away.score) ?? 0,
          scoreAgainst: (playsInName(team, past) === 'home' ? past.away.score : past.home.score) ?? 0,
          date: past.kickoff,
          home: playsInName(team, past) === 'home',
          outcome: outcomeOf(past, team),
          narrative: narrativeFor(past, rows),
        }
      : null,
    nextMatch: upcoming
      ? {
          opponent: displayName(playsInName(team, upcoming) === 'home' ? upcoming.away.name : upcoming.home.name),
          kickoff: upcoming.kickoff,
          home: playsInName(team, upcoming) === 'home',
        }
      : null,
    scenario,
    legionnaire: dossier,
  };
}

function playsInName(team: string, match: Match): 'home' | 'away' | null {
  if (clubNamesMatch(team, match.home.name)) return 'home';
  if (clubNamesMatch(team, match.away.name)) return 'away';
  return null;
}

function outcomeOf(match: Match, team: string): 'win' | 'draw' | 'loss' {
  const side = playsInName(team, match);
  const forScore = (side === 'home' ? match.home.score : match.away.score) ?? 0;
  const againstScore = (side === 'home' ? match.away.score : match.home.score) ?? 0;
  if (forScore > againstScore) return 'win';
  if (forScore < againstScore) return 'loss';
  return 'draw';
}

export { playsIn };
