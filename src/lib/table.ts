import type {
  CompetitionId,
  Match,
  Standing,
  TableRow,
  TableScenario,
} from './types';
import { displayName, isIsraeliClub, normalize } from '../data/competitions';

/**
 * הטבלה, אחרי החלת משחקי היום של כל קבוצה.
 *
 * הספק מחזיר טבלה שמשקפת רק משחקים שהסתיימו. כאן מחילים עליה את
 * משחקי היום: אם משחק כבר הסתיים — התוצאה האמיתית; אם עוד לא התחיל —
 * שום דבר לא זז, אבל המשחק מסומן כדי ש-buildScenarios יוכל לתאר מה
 * ניצחון או הפסד היום היו עושים. זו לא טבלה חיה שרצה תוך כדי משחק —
 * היא מתעדכנת פעם או פעמיים ביום, יחד עם הקאש.
 *
 * המיון מבוסס על חוקי הכרעה כלליים (נקודות, הפרש, שערי זכות). ליגות
 * מסוימות מכריעות קודם במפגשים הישירים, ולכן שוויון נקודות עשוי
 * להסתדר אצלנו אחרת מאשר בטבלה הרשמית. במקרה כזה שורת הבסיס מהספק
 * היא הקובעת, ואנחנו מציגים את ההפרש כהקרנה — לא כעובדה.
 */

interface TodayInfo {
  matchId: string;
  finished: boolean;
  label: string;
  delta?: { points: number; goalsFor: number; goalsAgainst: number };
}

function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** נקודות שהקבוצה מקבלת מתוצאה סופית. */
function pointsFor(scored: number, conceded: number): number {
  if (scored > conceded) return 3;
  if (scored === conceded) return 1;
  return 0;
}

/**
 * ממפה כל קבוצה עם משחק היום למה שקרה (או עומד לקרות) לה.
 * המפתח הוא שם מנורמל, כי לא תמיד יש לנו מזהה ספק בשני הצדדים.
 */
function collectToday(matches: Match[], competition: CompetitionId, now: Date): Map<string, TodayInfo> {
  const out = new Map<string, TodayInfo>();

  for (const m of matches) {
    if (m.competition !== competition) continue;
    if (!isSameDay(m.kickoff, now)) continue;

    const finished = m.status === 'finished' && m.home.score !== null && m.away.score !== null;

    out.set(normalize(m.home.name), {
      matchId: m.id,
      finished,
      label: finished
        ? `${m.home.score}-${m.away.score} מול ${displayName(m.away.name)}`
        : `היום נגד ${displayName(m.away.name)}`,
      delta: finished
        ? { points: pointsFor(m.home.score!, m.away.score!), goalsFor: m.home.score!, goalsAgainst: m.away.score! }
        : undefined,
    });

    out.set(normalize(m.away.name), {
      matchId: m.id,
      finished,
      label: finished
        ? `${m.away.score}-${m.home.score} מול ${displayName(m.home.name)}`
        : `היום נגד ${displayName(m.home.name)}`,
      delta: finished
        ? { points: pointsFor(m.away.score!, m.home.score!), goalsFor: m.away.score!, goalsAgainst: m.home.score! }
        : undefined,
    });
  }

  return out;
}

function compareRows(a: TableRow, b: TableRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const diffA = a.goalsFor - a.goalsAgainst;
  const diffB = b.goalsFor - b.goalsAgainst;
  if (diffB !== diffA) return diffB - diffA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  // שוויון גמור — שומרים על הסדר שהספק קבע, שמכיר את חוקי ההכרעה
  return a.baseRank - b.baseRank;
}

/**
 * הטבלה אחרי החלת משחקי היום.
 * אם אין לתחרות משחקים היום, מוחזרת הטבלה כפי שהיא עם הפרשים אפס.
 */
export function buildTable(
  standings: Standing[],
  matches: Match[],
  competition: CompetitionId,
  now = new Date(),
): TableRow[] {
  const base = standings
    .filter((s) => s.competition === competition)
    .sort((a, b) => a.rank - b.rank);
  if (!base.length) return [];

  const today = collectToday(matches, competition, now);

  const rows: TableRow[] = base.map((s) => {
    const info = today.get(normalize(s.team));
    const delta = info?.delta;
    return {
      ...s,
      baseRank: s.rank,
      basePoints: s.points,
      baseGoalsFor: s.goalsFor,
      baseGoalsAgainst: s.goalsAgainst,
      points: s.points + (delta?.points ?? 0),
      played: s.played + (delta ? 1 : 0),
      won: s.won + (delta && delta.points === 3 ? 1 : 0),
      drawn: s.drawn + (delta && delta.points === 1 ? 1 : 0),
      lost: s.lost + (delta && delta.points === 0 ? 1 : 0),
      goalsFor: s.goalsFor + (delta?.goalsFor ?? 0),
      goalsAgainst: s.goalsAgainst + (delta?.goalsAgainst ?? 0),
      rankDelta: 0,
      pointsDelta: delta?.points ?? 0,
      todayMatchId: info?.matchId,
      todayLabel: info?.label,
      todayFinished: info?.finished,
    };
  });

  rows.sort(compareRows);
  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.rankDelta = row.baseRank - row.rank; // חיובי = עלה בטבלה
  });

  return rows;
}

/* ------------------------------------------------------------------ */
/* תרחישים                                                             */
/* ------------------------------------------------------------------ */

function ordinal(rank: number): string {
  const words = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];
  return words[rank] ?? `ה-${rank}`;
}

/**
 * מחשב מחדש את הטבלה כאילו קבוצה אחת סיימה בתוצאה אחרת, ומחזיר את
 * המיקום שהיא הייתה מקבלת. כך אפשר לומר "ניצחון מעלה למקום 2" בלי
 * לנחש — הטבלה באמת מחושבת שוב, מנקודת הבסיס שלפני משחקי היום.
 */
function rankIfPoints(rows: TableRow[], teamId: number, points: number): number {
  const hypothetical = rows.map((r) => {
    if (r.teamId !== teamId) return r;
    // הנחה צנועה: ניצחון בהפרש שער אחד, תיקו שומר על ההפרש, הפסד
    // בשער. תוצאה רחבה יותר רק תשפר את המיקום, לא תרע אותו.
    const swing = points === 3 ? 1 : points === 1 ? 0 : -1;
    return {
      ...r,
      points: r.basePoints + points,
      goalsFor: r.baseGoalsFor + Math.max(swing, 0),
      goalsAgainst: r.baseGoalsAgainst + Math.max(-swing, 0),
    };
  });
  hypothetical.sort(compareRows);
  return hypothetical.findIndex((r) => r.teamId === teamId) + 1;
}

/**
 * משפטי תרחיש למשחקי היום — רק כאלה שבאמת משנים משהו.
 *
 * למשחק שהסתיים: עובדה על מה שקרה בפועל ("עלתה היום למקום 2").
 * למשחק שעוד לא התחיל: תחזית ("ניצחון היום ותעלה למקום 2"). קבוצה
 * שמשחקת ולא משנה כלום — בין אם ניצחה או הפסידה, בין אם התוצאה טרם
 * נקבעה — לא מקבלת משפט; זה בדיוק החפירה שרוצים להימנע ממנה.
 */
export function buildScenarios(
  rows: TableRow[],
  competition: CompetitionId,
  limit = 3,
): TableScenario[] {
  const out: TableScenario[] = [];
  const today = new Map(rows.filter((r) => r.todayMatchId).map((r) => [r.teamId, r]));

  for (const row of today.values()) {
    const name = displayName(row.team);
    const pending = !row.todayFinished;

    if (!pending) {
      // המשחק הסתיים — מדווחים רק אם זה באמת הזיז אותה
      if (row.rankDelta === 0) continue;
      out.push({
        competition,
        teamId: row.teamId,
        tone: row.rankDelta > 0 ? 'up' : 'down',
        realized: true,
        text:
          row.rankDelta > 0
            ? `${name} עלתה היום למקום ${ordinal(row.rank)} — הייתה ${ordinal(row.baseRank)}`
            : `${name} ירדה היום למקום ${ordinal(row.rank)} — הייתה ${ordinal(row.baseRank)}`,
      });
      continue;
    }

    // המשחק עוד לא הסתיים — תחזית מנקודת הבסיס
    const rankNow = row.baseRank;
    const rankWin = rankIfPoints(rows, row.teamId, 3);
    const rankLose = rankIfPoints(rows, row.teamId, 0);

    if (rankWin < rankNow) {
      out.push({
        competition,
        teamId: row.teamId,
        tone: 'up',
        realized: false,
        text: `ניצחון היום ו${name} עוברת למקום ${ordinal(rankWin)}`,
      });
    } else if (rankLose > rankNow) {
      out.push({
        competition,
        teamId: row.teamId,
        tone: 'down',
        realized: false,
        text: `הפסד היום ו${name} נופלת למקום ${ordinal(rankLose)}`,
      });
    }
  }

  // עניין ישראלי קודם, ואחריו הפסגה
  out.sort((a, b) => {
    const rowA = rows.find((r) => r.teamId === a.teamId);
    const rowB = rows.find((r) => r.teamId === b.teamId);
    const israeliA = rowA && isIsraeliClub(rowA.team) ? 0 : 1;
    const israeliB = rowB && isIsraeliClub(rowB.team) ? 0 : 1;
    if (israeliA !== israeliB) return israeliA - israeliB;
    return (rowA?.rank ?? 99) - (rowB?.rank ?? 99);
  });

  return out.slice(0, limit);
}

/**
 * המרחק מהפסגה ומהמקומות שמעניינים, כמשפט אחד. משמש גם בכרטיס הקבוצה
 * וגם בסיכום אחרי משחק.
 */
export function gapSentence(rows: TableRow[], teamId: number): string | null {
  const row = rows.find((r) => r.teamId === teamId);
  if (!row) return null;

  const leader = rows[0];
  if (row.rank === 1) {
    const second = rows[1];
    if (!second) return 'ראשונה בטבלה';
    const gap = row.points - second.points;
    return gap === 0 ? 'ראשונה בהפרש שערים' : `ראשונה, ${gap} נקודות יתרון`;
  }

  const gap = leader.points - row.points;
  const above = rows[row.rank - 2];
  if (above && leader.teamId !== above.teamId) {
    const near = above.points - row.points;
    if (near === 0) {
      return `מקום ${row.rank} · שווה ל${displayName(above.team)} בנקודות, ${gap} מהפסגה`;
    }
    if (near <= 3) {
      return `מקום ${row.rank} · ${near} מ${displayName(above.team)}, ${gap} מהפסגה`;
    }
  }
  return `מקום ${row.rank} · ${gap} נקודות מהפסגה`;
}

/** שורת הטבלה של קבוצה מסוימת, לפי שם או מזהה ספק — לשימוש במסך הקבוצות. */
export function rowForTeam(rows: TableRow[], team: string, teamId?: number): TableRow | null {
  if (teamId != null) {
    const byId = rows.find((r) => r.teamId === teamId);
    if (byId) return byId;
  }
  const name = normalize(team);
  return rows.find((r) => normalize(r.team) === name) ?? null;
}
