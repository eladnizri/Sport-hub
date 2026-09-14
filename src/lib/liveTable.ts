import type {
  CompetitionId,
  LiveTableRow,
  Match,
  Standing,
  TableScenario,
} from './types';
import { displayName, isIsraeliClub, normalize } from '../data/competitions';

/**
 * טבלה חיה.
 *
 * הספק מחזיר טבלה שמשקפת רק משחקים שהסתיימו. כאן מחילים עליה את
 * המשחקים שרצים כרגע — בהנחה שהתוצאה הנוכחית היא התוצאה הסופית —
 * ומחזירים גם את המיקום המוקרן וגם את המיקום שממנו יצאנו, כדי שהמסך
 * יוכל להראות את התנועה ולא רק את השורה.
 *
 * המיון מבוסס על חוקי הכרעה כלליים (נקודות, הפרש, שערי זכות). ליגות
 * מסוימות מכריעות קודם במפגשים הישירים, ולכן שוויון נקודות עשוי
 * להסתדר אצלנו אחרת מאשר בטבלה הרשמית. במקרה כזה שורת הבסיס מהספק
 * היא הקובעת, ואנחנו מציגים את ההפרש כהקרנה — לא כעובדה.
 */

interface TeamDelta {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  matchId: string;
  label: string;
}

const FINISHED_ENOUGH = new Set<Match['status']>(['live', 'halftime']);

/** נקודות שהקבוצה תיקח אם המשחק ייגמר כרגע. */
function pointsFor(scored: number, conceded: number): number {
  if (scored > conceded) return 3;
  if (scored === conceded) return 1;
  return 0;
}

function matchLabel(status: Match['status'], clock: string | null): string {
  if (status === 'halftime') return 'מחצית';
  return clock ?? 'חי';
}

/**
 * ממפה כל קבוצה שנמצאת כרגע במשחק חי לשינוי שהמשחק מייצר לה.
 * המפתח הוא שם מנורמל, כי לא תמיד יש לנו מזהה ספק בשני הצדדים.
 */
function collectDeltas(matches: Match[], competition: CompetitionId): Map<string, TeamDelta> {
  const deltas = new Map<string, TeamDelta>();

  for (const m of matches) {
    if (m.competition !== competition) continue;
    if (!FINISHED_ENOUGH.has(m.status)) continue;
    if (m.home.score === null || m.away.score === null) continue;

    const label = matchLabel(m.status, m.clock);

    deltas.set(normalize(m.home.name), {
      points: pointsFor(m.home.score, m.away.score),
      goalsFor: m.home.score,
      goalsAgainst: m.away.score,
      matchId: m.id,
      label: `${label} · ${m.home.score}-${m.away.score} מול ${displayName(m.away.name)}`,
    });

    deltas.set(normalize(m.away.name), {
      points: pointsFor(m.away.score, m.home.score),
      goalsFor: m.away.score,
      goalsAgainst: m.home.score,
      matchId: m.id,
      label: `${label} · ${m.away.score}-${m.home.score} מול ${displayName(m.home.name)}`,
    });
  }

  return deltas;
}

function compareRows(a: LiveTableRow, b: LiveTableRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const diffA = a.goalsFor - a.goalsAgainst;
  const diffB = b.goalsFor - b.goalsAgainst;
  if (diffB !== diffA) return diffB - diffA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  // שוויון גמור — שומרים על הסדר שהספק קבע, שמכיר את חוקי ההכרעה
  return a.baseRank - b.baseRank;
}

/**
 * הטבלה אחרי החלת המשחקים החיים.
 * אם אין משחקים חיים בתחרות, מוחזרת הטבלה כפי שהיא עם הפרשים אפס.
 */
export function buildLiveTable(
  standings: Standing[],
  matches: Match[],
  competition: CompetitionId,
): LiveTableRow[] {
  const base = standings
    .filter((s) => s.competition === competition)
    .sort((a, b) => a.rank - b.rank);
  if (!base.length) return [];

  const deltas = collectDeltas(matches, competition);

  const rows: LiveTableRow[] = base.map((s) => {
    const delta = deltas.get(normalize(s.team));
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
      liveMatchId: delta?.matchId,
      liveLabel: delta?.label,
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
 * לנחש — הטבלה באמת מחושבת שוב.
 */
function rankIfPoints(rows: LiveTableRow[], teamId: number, points: number): number {
  const hypothetical = rows.map((r) => {
    if (r.teamId !== teamId) return r;
    // מוציאים את תרומת המשחק החי ומחזירים תרומה משוערת: ניצחון בהפרש
    // שער אחד, תיקו שומר על ההפרש, הפסד בשער. זו ההנחה הצנועה ביותר —
    // תוצאה רחבה יותר רק תשפר את המיקום, לא תרע אותו.
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
 * משפטי תרחיש למשחקים שרצים כרגע — רק כאלה שבאמת משנים משהו.
 * קבוצה שמנצחת ונשארת באותו מקום לא מקבלת משפט; זה בדיוק החפירה
 * שאנחנו רוצים להימנע ממנה.
 */
export function buildScenarios(
  rows: LiveTableRow[],
  competition: CompetitionId,
  limit = 3,
): TableScenario[] {
  const out: TableScenario[] = [];

  for (const row of rows) {
    if (!row.liveMatchId) continue;

    const rankNow = row.rank;
    const rankWin = rankIfPoints(rows, row.teamId, 3);
    const rankLose = rankIfPoints(rows, row.teamId, 0);
    const name = displayName(row.team);

    // התוצאה הנוכחית כבר מזיזה אותו — זה הסיפור החשוב ביותר
    if (row.rankDelta !== 0) {
      out.push({
        competition,
        teamId: row.teamId,
        tone: row.rankDelta > 0 ? 'up' : 'down',
        text:
          row.rankDelta > 0
            ? `${name} עולה כרגע למקום ${ordinal(rankNow)} — הייתה ${ordinal(row.baseRank)}`
            : `${name} יורדת כרגע למקום ${ordinal(rankNow)} — הייתה ${ordinal(row.baseRank)}`,
      });
      continue;
    }

    // התוצאה לא מזיזה, אבל תוצאה אחרת כן הייתה מזיזה
    if (rankWin < rankNow) {
      out.push({
        competition,
        teamId: row.teamId,
        tone: 'up',
        text: `ניצחון ו${name} עוברת למקום ${ordinal(rankWin)}`,
      });
    } else if (rankLose > rankNow) {
      out.push({
        competition,
        teamId: row.teamId,
        tone: 'down',
        text: `הפסד ו${name} נופלת למקום ${ordinal(rankLose)}`,
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
 * המרחק מהפסגה ומהמקומות שמעניינים, כמשפט אחד. משמש גם בשורת ההקשר
 * שמתחת למשחק וגם בסיכום שאחריו.
 */
export function gapSentence(rows: LiveTableRow[], teamId: number): string | null {
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
