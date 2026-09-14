import type { Match, MatchNarrative, TableRow } from './types';
import { displayName, normalize } from '../data/competitions';
import { gapSentence } from './table';

/**
 * סיכום שלוש שורות למשחק שהסתיים: מה הכריע, מי בלט, מה המשמעות.
 *
 * זו תבנית הנופלת — היא רצה בדפדפן על כל משחק שאין לו סיכום אפוי
 * מהקאש. הגרסה האפויה נכתבת בצד השרת על ידי מודל שפה (ראה
 * scripts/build-cache.mjs) ומגיעה עם by: 'ai'. שתיהן ממלאות את אותו
 * מבנה, כך שהמסך לא צריך לדעת מי כתב.
 */

/** השחקן שהופיע הכי הרבה פעמים באירועי השערים. */
function topScorer(match: Match): { name: string; goals: number } | null {
  const tally = new Map<string, number>();
  for (const e of match.events) {
    if (e.type !== 'goal') continue;
    // הטקסט מגיע כ-"Normal Goal · שם השחקן". בלי המפריד אין לנו שם
    // שחקן אלא תיאור כללי, ואז עדיף לא לומר כלום מאשר להמציא "מבקיע".
    const parts = e.text.split('·');
    if (parts.length < 2) continue;
    const name = parts[parts.length - 1].trim();
    if (!name) continue;
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  if (!tally.size) return null;
  const [name, goals] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return { name, goals };
}

function statValue(match: Match, label: RegExp): { home: number; away: number } | null {
  const hit = match.stats?.find((s) => label.test(s.label));
  return hit ? { home: hit.home, away: hit.away } : null;
}

function verdictOf(match: Match): string {
  const home = displayName(match.home.name);
  const away = displayName(match.away.name);
  const hs = match.home.score ?? 0;
  const as = match.away.score ?? 0;
  const margin = Math.abs(hs - as);
  const winner = hs > as ? home : away;
  const loser = hs > as ? away : home;

  const shots = statValue(match, /shots|בעיטות/i);
  const possession = statValue(match, /possession|החזקה/i);

  if (hs === as) {
    if (hs === 0) return `${home} ו${away} נפרדו בלי שערים`;
    return `${home} ו${away} חילקו נקודה ב-${hs}-${as}`;
  }

  // ניצחון צר שלא תאם את מאזן ההזדמנויות — הסיפור הוא היעילות
  if (margin === 1 && shots) {
    const winnerShots = hs > as ? shots.home : shots.away;
    const loserShots = hs > as ? shots.away : shots.home;
    if (loserShots > winnerShots) {
      return `${winner} ניצחה ${Math.max(hs, as)}-${Math.min(hs, as)} למרות ש${loser} בעטה יותר`;
    }
  }

  if (margin >= 3) return `${winner} פירקה את ${loser} ${Math.max(hs, as)}-${Math.min(hs, as)}`;
  if (margin === 1 && possession) {
    const winnerPoss = hs > as ? possession.home : possession.away;
    if (winnerPoss < 45) return `${winner} לקחה את המשחק בלי הכדור`;
  }
  return `${winner} ניצחה ${Math.max(hs, as)}-${Math.min(hs, as)}`;
}

function standoutOf(match: Match): string {
  const scorer = topScorer(match);
  if (scorer) {
    if (scorer.goals >= 2) return `${scorer.name} — ${scorer.goals} שערים`;
    // "המכריע" נכון רק כשזה היה השער היחיד במשחק; אחרת הוא סתם כבש
    const total = (match.home.score ?? 0) + (match.away.score ?? 0);
    return total === 1 ? `${scorer.name} הכריע` : `${scorer.name} כבש`;
  }
  if ((match.home.score ?? 0) + (match.away.score ?? 0) === 0) {
    return 'שתי ההגנות לא נשברו';
  }
  return 'אין פירוט מבקיעים למשחק הזה';
}

/**
 * מאתר את שורת הטבלה של צד במשחק. מזהה הספק הוא הדרך המדויקת, אבל הוא
 * לא תמיד קיים בשני הצדדים — ואז נופלים להשוואת שם מנורמלת.
 */
function rowFor(table: TableRow[], side: Match['home']): TableRow | undefined {
  if (side.providerId != null) {
    const byId = table.find((r) => r.teamId === side.providerId);
    if (byId) return byId;
  }
  const name = normalize(side.name);
  return table.find((r) => normalize(r.team) === name);
}

function meaningOf(match: Match, table: TableRow[]): string {
  const hs = match.home.score ?? 0;
  const as = match.away.score ?? 0;

  if (hs !== as) {
    const winner = hs > as ? match.home : match.away;
    const row = rowFor(table, winner);
    const line = row ? gapSentence(table, row.teamId) : null;
    if (line) return `${displayName(winner.name)}: ${line}`;
  }

  // בתיקו, מעניין יותר מה זה עשה למי שהיה גבוה יותר בטבלה
  const homeRow = rowFor(table, match.home);
  const awayRow = rowFor(table, match.away);
  const higher = homeRow && awayRow ? (homeRow.rank < awayRow.rank ? homeRow : awayRow) : homeRow ?? awayRow;
  if (higher) {
    const line = gapSentence(table, higher.teamId);
    if (line) return `${displayName(higher.team)}: ${line}`;
  }
  return 'אין טבלה זמינה לתחרות הזאת';
}

/** סיכום תבניתי. מחזיר null אם המשחק לא הסתיים או שאין תוצאה. */
export function templateNarrative(match: Match, table: TableRow[] = []): MatchNarrative | null {
  if (match.status !== 'finished') return null;
  if (match.home.score === null || match.away.score === null) return null;

  return {
    verdict: verdictOf(match),
    standout: standoutOf(match),
    meaning: meaningOf(match, table),
    by: 'template',
  };
}

/** הסיכום להצגה: האפוי מהקאש אם יש, אחרת התבנית. */
export function narrativeFor(match: Match, table: TableRow[] = []): MatchNarrative | null {
  return match.narrative ?? templateNarrative(match, table);
}
