import type { CompetitionId, FeedResult, LegionnaireReport, Match, TransferItem } from '../lib/types';
import { demoLegionnaires, demoMatches, demoTransfers } from './providers/demo';
import { fetchFootballByDate, fetchLiveFootball, hasFootballKey } from './providers/apiFootball';
import { fetchNbaByDate, hasNbaKey } from './providers/balldontlie';

/**
 * שכבת הנתונים היחידה שהמסכים מדברים איתה.
 *
 * אם הוגדר מפתח API — מושכים אמת. אם לא, או אם הקריאה נכשלה, נופלים
 * לספק הדמו ומסמנים את המקור כ-demo, כך שהמסך תמיד אומר את האמת על
 * מה שהוא מציג.
 */

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sortMatches(matches: Match[]): Match[] {
  const rank: Record<Match['status'], number> = {
    live: 0, halftime: 1, scheduled: 2, finished: 3, postponed: 4,
  };
  return [...matches].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.kickoff.localeCompare(b.kickoff),
  );
}

export function providersConfigured(): { football: boolean; nba: boolean } {
  return { football: hasFootballKey(), nba: hasNbaKey() };
}

export async function getMatches(
  competitions: CompetitionId[],
  date = new Date(),
): Promise<FeedResult<Match>> {
  const fetchedAt = new Date().toISOString();
  const { football, nba } = providersConfigured();
  const wantsNba = competitions.includes('nba');

  if (!football && !nba) {
    return {
      items: sortMatches(demoMatches(date).filter((m) => competitions.includes(m.competition))),
      source: 'demo',
      fetchedAt,
    };
  }

  const day = isoDate(date);
  const errors: string[] = [];
  const collected: Match[] = [];

  if (football) {
    try {
      const [live, scheduled] = await Promise.all([
        fetchLiveFootball(competitions),
        fetchFootballByDate(day, competitions),
      ]);
      // המשחקים החיים מנצחים על גרסת הלוח היומי של אותו משחק
      const liveIds = new Set(live.map((m) => m.id));
      collected.push(...live, ...scheduled.filter((m) => !liveIds.has(m.id)));
    } catch (err) {
      errors.push(String(err));
    }
  }

  if (nba && wantsNba) {
    try {
      collected.push(...(await fetchNbaByDate(day)));
    } catch (err) {
      errors.push(String(err));
    }
  }

  // ליגות שאין להן ספק מוגדר עדיין (יורוליג, וכל ליגה שנכשלה) מגיעות מהדמו
  const covered = new Set(collected.map((m) => m.competition));
  const gaps = competitions.filter((c) => !covered.has(c));
  const filler = gaps.length
    ? demoMatches(date).filter((m) => gaps.includes(m.competition))
    : [];

  const items = sortMatches([...collected, ...filler].filter((m) => competitions.includes(m.competition)));

  return {
    items,
    source: collected.length ? 'live' : 'demo',
    fetchedAt,
    error: errors.length ? errors.join(' | ') : undefined,
  };
}

export async function getLegionnaires(date = new Date()): Promise<FeedResult<LegionnaireReport>> {
  // דוחות הלגיונרים נבנים מעל לוח המשחקים, כך שהם משתפרים אוטומטית
  // ברגע שספק אמיתי מחובר.
  const matches = await getMatches(
    ['ligat-haal', 'premier-league', 'champions-league', 'europa-conference', 'nba', 'euroleague'],
    date,
  );
  return {
    items: demoLegionnaires(date, matches.items),
    source: matches.source,
    fetchedAt: matches.fetchedAt,
  };
}

export async function getTransfers(date = new Date()): Promise<FeedResult<TransferItem>> {
  // אין ספק העברות ציבורי אמין; הפיד נשען על מקור עריכתי. עד לחיבור
  // כזה, הרדאר רץ על הפיד המקומי ומסומן כדמו.
  return { items: demoTransfers(date), source: 'demo', fetchedAt: new Date().toISOString() };
}
