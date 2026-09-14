import type {
  CompetitionId,
  Legionnaire,
  Match,
  NewsItem,
  Standing,
  TableRow,
  TransferItem,
} from './types';
import { clubNamesMatch, displayName, isIsraeliClub } from '../data/competitions';
import { matchInCircle } from './circle';
import { narrativeFor } from './narrative';
import { buildTable } from './table';

/**
 * פיד הסקירה.
 *
 * ברירת המחדל היא סיכומים שנבנים מהנתונים שכבר יש לנו — תוצאה, תנועה
 * בטבלה, עדכון העברה — כדי שהמסך הראשי תמיד יש לו מה להראות גם בלי
 * מקור חדשות חיצוני. כותרות אמיתיות מ-RSS (headlines) מתמזגות לאותו
 * פיד כשהן קיימות, עם שם המקור גלוי.
 *
 * שני חוקי יסוד:
 *  1. הכל מסונן למעגל המעקב שלך — לא כל משחק בכל ליגה.
 *  2. תנועת טבלה "פסיבית" (קבוצה שעלתה כי מישהו אחר הפסיד, לא כי היא
 *     שיחקה) מדווחת רק אם standings משקף את המצב לפני משחקי היום —
 *     זו אחריות סקריפט הקאש (ראה scripts/build-cache.mjs), לא כאן.
 */

const RECENT_HOURS = 36;

function isRecent(iso: string, now: Date, hours = RECENT_HOURS): boolean {
  const diff = now.getTime() - new Date(iso).getTime();
  return diff >= 0 && diff <= hours * 3600 * 1000;
}

interface BuildNewsInput {
  matches: Match[];
  standings: Standing[];
  transfers: TransferItem[];
  headlines: NewsItem[];
  legionnaires: Legionnaire[];
  followedTeams: string[];
  hiddenTeams: string[];
  now: Date;
}

export function buildNews(input: BuildNewsInput): NewsItem[] {
  const { matches, standings, transfers, headlines, legionnaires, followedTeams, hiddenTeams, now } = input;
  const inCircle = (m: Match) => matchInCircle(m, legionnaires, followedTeams, hiddenTeams);

  const items: NewsItem[] = [];
  const tableCache = new Map<CompetitionId, TableRow[]>();
  const tableFor = (competition: CompetitionId) => {
    let rows = tableCache.get(competition);
    if (!rows) {
      rows = buildTable(standings, matches, competition, now);
      tableCache.set(competition, rows);
    }
    return rows;
  };

  /* --- תוצאות --- */

  for (const m of matches) {
    if (m.status !== 'finished' || m.home.score === null || m.away.score === null) continue;
    if (!isRecent(m.kickoff, now)) continue;
    if (!inCircle(m)) continue;

    const narrative = narrativeFor(m, tableFor(m.competition));
    if (!narrative) continue;

    items.push({
      id: `result-${m.id}`,
      category: 'result',
      text: `${narrative.verdict} · ${narrative.meaning}`,
      competition: m.competition,
      teams: [m.home.name, m.away.name],
      publishedAt: m.kickoff,
      source: 'generated',
    });
  }

  /* --- תנועת טבלה פסיבית: קבוצה שזזה בלי לשחק --- */

  const roster = new Set<string>();
  for (const l of legionnaires) if (l.club) roster.add(l.club);
  for (const t of followedTeams) roster.add(t);

  for (const [competition, rows] of tableCache) {
    for (const row of rows) {
      if (row.rankDelta === 0) continue;
      if (row.todayMatchId) continue; // כבר מסופר כ-'result'
      items.push({
        id: `table-${competition}-${row.teamId}-${now.toDateString()}`,
        category: 'table',
        text:
          row.rankDelta > 0
            ? `${displayName(row.team)} עלתה למקום ${row.rank} בעקבות תוצאות אחרות היום`
            : `${displayName(row.team)} ירדה למקום ${row.rank} בעקבות תוצאות אחרות היום`,
        competition,
        teams: [row.team],
        publishedAt: now.toISOString(),
        source: 'generated',
      });
    }
  }

  /* --- העברות --- */

  for (const t of transfers) {
    if (!isRecent(t.publishedAt, now, 72)) continue;
    const relevant =
      legionnaires.some(
        (l) => clubNamesMatch(l.name, t.player) || (l.club && (clubNamesMatch(l.club, t.fromClub) || clubNamesMatch(l.club, t.toClub))),
      ) ||
      isIsraeliClub(t.fromClub) ||
      isIsraeliClub(t.toClub) ||
      followedTeams.some((f) => clubNamesMatch(f, t.fromClub) || clubNamesMatch(f, t.toClub));
    if (!relevant) continue;

    items.push({
      id: `transfer-${t.id}`,
      category: 'transfer',
      text: `${t.player}: ${displayName(t.fromClub)} ← ${displayName(t.toClub)}. ${t.summary}`,
      competition: t.competitions[0],
      teams: [t.fromClub, t.toClub],
      publishedAt: t.publishedAt,
      source: t.source,
    });
  }

  /* --- כותרות אמיתיות --- */

  for (const h of headlines) {
    if (!isRecent(h.publishedAt, now, 48)) continue;
    items.push(h);
  }

  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
