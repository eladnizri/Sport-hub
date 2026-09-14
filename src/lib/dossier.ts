import type {
  Legionnaire,
  LegionnaireAppearance,
  LegionnaireDossier,
  LegionnaireTrend,
  Match,
} from './types';
import { clubNamesMatch, displayName } from '../data/competitions';

/**
 * בניית תיק הלגיונר.
 *
 * השאלה שהמסך הזה עונה עליה היא "הוא בדרך למעלה או למטה", ולא "כמה
 * דקות שיחק אתמול". לכן הכל כאן נגזר מחלון של חמישה משחקים אחרונים,
 * ולא מהמשחק הבודד האחרון.
 */

const WINDOW = 5;

/** האם המועדון של השחקן הוא אחד הצדדים במשחק. */
export function playsIn(player: Legionnaire, match: Match): 'home' | 'away' | null {
  if (player.clubId) {
    if (match.home.providerId === player.clubId) return 'home';
    if (match.away.providerId === player.clubId) return 'away';
  }
  if (clubNamesMatch(player.club, match.home.name)) return 'home';
  if (clubNamesMatch(player.club, match.away.name)) return 'away';
  return null;
}

/**
 * כיוון המגמה: משווים את שני המשחקים האחרונים לשלושה שלפניהם.
 * סף של 15 דקות, כדי שרעש רגיל לא ייקרא "מגמה".
 */
function trendOf(recent: LegionnaireAppearance[]): LegionnaireTrend {
  if (recent.length < 3) return 'unknown';
  const newest = recent.slice(0, 2);
  const older = recent.slice(2);
  if (!older.length) return 'unknown';

  const avg = (rows: LegionnaireAppearance[]) =>
    rows.reduce((sum, r) => sum + r.minutes, 0) / rows.length;

  const delta = avg(newest) - avg(older);
  if (delta >= 15) return 'rising';
  if (delta <= -15) return 'falling';
  return 'steady';
}

/**
 * משפט אחד על המעמד בקבוצה. מתאר את מה שבולט בחלון — רצף הרכבים,
 * ירידה לספסל, או חזרה — במקום לשפוך מספרים.
 */
function standingOf(recent: LegionnaireAppearance[]): string {
  if (!recent.length) return 'אין נתוני משחקים אחרונים';

  let streak = 0;
  for (const a of recent) {
    if (a.started) streak++;
    else break;
  }

  if (streak >= 3) return `${streak} הרכבים רצופים`;

  // כמה משחקים רצופים מהחדש ביותר עברו בלי דקות כלל
  const firstWithMinutes = recent.findIndex((a) => a.minutes > 0);
  const benchStreak = firstWithMinutes === -1 ? recent.length : firstWithMinutes;
  if (benchStreak >= 2) return `${benchStreak} משחקים בלי דקות`;

  const starts = recent.filter((a) => a.started).length;

  if (starts === 0) return `נכנס מהספסל ב-${recent.length} האחרונים`;
  if (starts === recent.length) return 'הרכב קבוע';
  return `${starts} הרכבים מתוך ${recent.length}`;
}

interface BuildInput {
  player: Legionnaire;
  /** היסטוריית הופעות מהקאש, החדשה ביותר ראשונה או לא ממוינת */
  history: LegionnaireAppearance[];
  /** לוח המשחקים הרלוונטי — משמש לזהות משחק חי ואת המשחק הבא */
  matches: Match[];
  now?: Date;
}

export function buildDossier({ player, history, matches, now = new Date() }: BuildInput): LegionnaireDossier {
  const recent = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, WINDOW);

  const trend = trendOf(recent);
  const latest = recent[0] ?? null;

  const liveMatch = matches.find(
    (m) => (m.status === 'live' || m.status === 'halftime') && playsIn(player, m),
  );

  const next = matches
    .filter((m) => m.status === 'scheduled' && new Date(m.kickoff) > now && playsIn(player, m))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];

  let status: LegionnaireDossier['status'] = 'unknown';
  if (liveMatch) {
    // אם יש הופעה מעודכנת למשחק הזה עם דקות — הוא על המגרש
    const live = history.find((a) => a.fixtureId === liveMatch.id);
    status = live && live.minutes > 0 ? 'playing' : 'bench';
  } else if (latest && isToday(latest.date, now)) {
    status = latest.minutes > 0 ? 'played' : 'bench';
  } else if (next) {
    status = 'upcoming';
  } else if (latest) {
    status = 'played';
  }

  const avgMinutes = recent.length
    ? Math.round(recent.reduce((sum, a) => sum + a.minutes, 0) / recent.length)
    : 0;

  return {
    player,
    status,
    latest,
    recent,
    avgMinutes,
    starts: recent.filter((a) => a.started).length,
    trend,
    standing: standingOf(recent),
    next: next
      ? {
          kickoff: next.kickoff,
          opponent: displayName(
            playsIn(player, next) === 'home' ? next.away.name : next.home.name,
          ),
          competition: next.competition,
        }
      : null,
    goals: recent.reduce((sum, a) => sum + a.goals, 0),
    assists: recent.reduce((sum, a) => sum + a.assists, 0),
  };
}

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * סדר התצוגה: מי שעל המגרש עכשיו למעלה, אחר כך מי ששיחק היום, אחר כך
 * מי שמשחק בקרוב. בתוך כל קבוצה — תרומות קודם.
 */
export function sortDossiers(items: LegionnaireDossier[]): LegionnaireDossier[] {
  const rank: Record<LegionnaireDossier['status'], number> = {
    playing: 0, played: 1, bench: 2, upcoming: 3, out: 4, unknown: 5,
  };
  return [...items].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const contribA = (a.latest?.goals ?? 0) + (a.latest?.assists ?? 0);
    const contribB = (b.latest?.goals ?? 0) + (b.latest?.assists ?? 0);
    if (contribA !== contribB) return contribB - contribA;
    return (b.latest?.minutes ?? 0) - (a.latest?.minutes ?? 0);
  });
}
