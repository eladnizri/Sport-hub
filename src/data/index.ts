import type {
  CompetitionId,
  FeedResult,
  FeedSource,
  Legionnaire,
  LegionnaireAppearance,
  LegionnaireDossier,
  Match,
  Standing,
  TransferItem,
} from '../lib/types';
import { buildDossier, sortDossiers } from '../lib/dossier';
import { isMine } from '../lib/myMatches';
import { templateNarrative } from '../lib/narrative';
import { buildLiveTable } from '../lib/liveTable';
import { BASE_LEGIONNAIRES, mergeLegionnaires } from './legionnaires';
import { demoAppearances, demoMatches, demoStandings, demoTransfers } from './providers/demo';
import { loadSnapshot, type Snapshot } from './providers/cache';
import { fetchLiveFootball, hasFootballKey } from './providers/apiFootball';

/**
 * שכבת הנתונים היחידה שהמסכים מדברים איתה.
 *
 * סדר העדיפויות:
 *  1. הקאש הסטטי שה-Action בנה — המקור הראשי. מהיר, בלי מפתחות בדפדפן.
 *  2. רענון חי מ-api-football — רק אם יש מפתח בצד הלקוח ורק כשיש על
 *     המסך משחק שסומן כשלך. כך תקציב 100 הקריאות ביום לא נשרף על
 *     משחקים שלא אכפת לך מהם.
 *  3. ספק הדמו — כשאין קאש ואין מפתח.
 *
 * המקור שבו השתמשנו בפועל מוחזר בכל תוצאה ומוצג במסך, כדי ששום מספר
 * לא יתחזה למשהו שהוא לא.
 */

export interface LegionnairePrefs {
  custom: Legionnaire[];
  hiddenIds: string[];
}

const NO_CUSTOM: LegionnairePrefs = { custom: [], hiddenIds: [] };

function sortMatches(matches: Match[]): Match[] {
  const rank: Record<Match['status'], number> = {
    live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4,
  };
  return [...matches].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.kickoff.localeCompare(b.kickoff),
  );
}

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

interface Resolved {
  snapshot: Snapshot;
  source: FeedSource;
  error?: string;
}

/**
 * טוען את הקאש ומחליף בו את המשחקים החיים בגרסה טרייה, אם וכאשר יש
 * על המסך משחק שמעניין אותך. הקריאה החיה נעשית פעם אחת לכל הליגות.
 */
async function resolve(
  competitions: CompetitionId[],
  legionnaires: Legionnaire[],
  followedTeams: string[],
  now: Date,
  allowLive: boolean,
): Promise<Resolved> {
  const snapshot = await loadSnapshot();

  if (!snapshot) {
    return { snapshot: demoSnapshot(now), source: 'demo' };
  }

  if (!allowLive || !hasFootballKey()) {
    return { snapshot, source: 'cache' };
  }

  // יש בקאש משחק חי שמעניין אותך? רק אז שורפים קריאה.
  const worthIt = snapshot.matches.some(
    (m) =>
      (m.status === 'live' || m.status === 'halftime') &&
      competitions.includes(m.competition) &&
      isMine(m, legionnaires, followedTeams),
  );
  if (!worthIt) return { snapshot, source: 'cache' };

  try {
    const live = await fetchLiveFootball(competitions);
    if (!live.length) return { snapshot, source: 'cache' };

    const liveById = new Map(live.map((m) => [m.id, m]));
    const merged = snapshot.matches.map((m) => liveById.get(m.id) ?? m);
    // משחק שהתחיל אחרי בניית הקאש עדיין לא נמצא בו
    for (const m of live) if (!merged.some((x) => x.id === m.id)) merged.push(m);

    return { snapshot: { ...snapshot, matches: merged }, source: 'live' };
  } catch (err) {
    return { snapshot, source: 'cache', error: String(err) };
  }
}

export function providersConfigured(): { football: boolean } {
  return { football: hasFootballKey() };
}

export interface MatchQuery {
  competitions: CompetitionId[];
  legionnaires?: Legionnaire[];
  followedTeams?: string[];
  date?: Date;
  /** מותר לשרוף קריאה חיה עבור משחק שסומן כשלך */
  allowLive?: boolean;
}

/**
 * לוח המשחקים להצגה.
 *
 * הסינון כאן הוא מה שמפריד בין "כל מה שיש בקאש" לבין "מה שאתה רוצה
 * לראות": רק תחרויות שבחרת (ולכן ה-NBA, שמסומן legionnaireOnly, לא
 * נכנס), ורק היום — למעט משחק שרץ עכשיו וגלש מעבר לחצות.
 */
function visibleMatches(snapshot: Snapshot, competitions: CompetitionId[], date: Date): Match[] {
  return sortMatches(
    snapshot.matches
      .filter((m) => competitions.includes(m.competition))
      .filter((m) => isToday(m.kickoff, date) || m.status === 'live' || m.status === 'halftime')
      .map((m) => {
        if (m.narrative || m.status !== 'finished') return m;
        // משחק שהסתיים אחרי בניית הקאש לא קיבל סיכום אפוי — בונים תבנית
        const table = buildLiveTable(snapshot.standings, snapshot.matches, m.competition);
        return { ...m, narrative: templateNarrative(m, table) ?? undefined };
      }),
  );
}

export async function getMatches({
  competitions,
  legionnaires = BASE_LEGIONNAIRES,
  followedTeams = [],
  date = new Date(),
  allowLive = true,
}: MatchQuery): Promise<FeedResult<Match>> {
  const { snapshot, source, error } = await resolve(
    competitions, legionnaires, followedTeams, date, allowLive,
  );

  return {
    items: visibleMatches(snapshot, competitions, date),
    source,
    fetchedAt: new Date().toISOString(),
    builtAt: snapshot.builtAt,
    error,
  };
}

/** הטבלאות הגולמיות, לפני החלת משחקים חיים. */
export async function getStandings(date = new Date()): Promise<FeedResult<Standing>> {
  const snapshot = (await loadSnapshot()) ?? demoSnapshot(date);
  return {
    items: snapshot.standings,
    source: snapshot.builtAt ? 'cache' : 'demo',
    fetchedAt: new Date().toISOString(),
    builtAt: snapshot.builtAt,
  };
}

/**
 * הטבלה החיה יחד עם לוח המשחקים שבנה אותה — המסך צריך את שניהם, ואין
 * טעם לטעון את הקאש פעמיים.
 */
export async function getTableView(query: MatchQuery): Promise<
  FeedResult<Standing> & { matches: Match[]; visible: Match[] }
> {
  const date = query.date ?? new Date();
  const { snapshot, source, error } = await resolve(
    query.competitions,
    query.legionnaires ?? BASE_LEGIONNAIRES,
    query.followedTeams ?? [],
    date,
    query.allowLive ?? true,
  );
  return {
    items: snapshot.standings,
    // `matches` הוא הסט המלא, כי חישוב הטבלה החיה צריך גם משחקים
    // בתחרויות שלא מוצגות כרגע. `visible` הוא מה שמותר להציג.
    matches: snapshot.matches,
    visible: visibleMatches(snapshot, query.competitions, date),
    source,
    fetchedAt: new Date().toISOString(),
    builtAt: snapshot.builtAt,
    error,
  };
}

export interface LegionQuery {
  prefs?: LegionnairePrefs;
  date?: Date;
  allowLive?: boolean;
}

/** רשימת הלגיונרים אחרי מיזוג שלוש השכבות. */
export async function getLegionnaireList(prefs: LegionnairePrefs = NO_CUSTOM): Promise<Legionnaire[]> {
  const snapshot = await loadSnapshot();
  return mergeLegionnaires(
    BASE_LEGIONNAIRES,
    snapshot?.legionnaires ?? [],
    prefs.custom,
    prefs.hiddenIds,
  );
}

export async function getLegionnaires({
  prefs = NO_CUSTOM,
  date = new Date(),
  allowLive = true,
}: LegionQuery = {}): Promise<FeedResult<LegionnaireDossier>> {
  const players = await getLegionnaireList(prefs);
  const { snapshot, source, error } = await resolve(
    [], players, [], date, allowLive,
  );

  const appearances: Record<string, LegionnaireAppearance[]> = snapshot.appearances ?? {};

  const items = sortDossiers(
    players.map((player) =>
      buildDossier({
        player,
        history: appearances[player.id] ?? [],
        matches: snapshot.matches,
        now: date,
      }),
    ),
  );

  return { items, source, fetchedAt: new Date().toISOString(), builtAt: snapshot.builtAt, error };
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
