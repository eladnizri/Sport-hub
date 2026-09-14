import type { Legionnaire, Match } from './types';
import { ISRAELI_CLUBS, clubNamesMatch, isIsraeliClub, normalize } from '../data/competitions';

/**
 * מעגל המעקב שלך — לא "כל הקבוצות בכל הטבלאות" אלא מעגל מצומצם
 * שאפשר להרחיב: קבוצות ישראליות ומועדוני לגיונרים כברירת מחדל, פלוס
 * מה שתוסיף ידנית, פחות מה שתסיר. זו הרשימה שמסך הקבוצות בנוי עליה,
 * וגם מה שקובע אילו תוצאות ותנועות טבלה נכנסות לפיד הסקירה.
 */

export interface CircleReason {
  israeli: boolean;
  legionnaire: Legionnaire | null;
  followed: boolean;
}

function isHidden(team: string, hiddenTeams: string[]): boolean {
  return hiddenTeams.some((h) => clubNamesMatch(h, team));
}

/** הסיבה שקבוצה נמצאת במעגל שלך — או null אם היא לא. */
export function circleReason(
  team: string,
  legionnaires: Legionnaire[],
  followedTeams: string[],
  hiddenTeams: string[],
): CircleReason | null {
  if (isHidden(team, hiddenTeams)) return null;

  const israeli = isIsraeliClub(team);
  const legionnaire = legionnaires.find((p) => clubNamesMatch(p.club, team)) ?? null;
  const followed = followedTeams.some((f) => clubNamesMatch(f, team));

  if (!israeli && !legionnaire && !followed) return null;
  return { israeli, legionnaire, followed };
}

export function inCircle(
  team: string,
  legionnaires: Legionnaire[],
  followedTeams: string[],
  hiddenTeams: string[],
): boolean {
  return circleReason(team, legionnaires, followedTeams, hiddenTeams) != null;
}

/** true אם אחד הצדדים במשחק נמצא במעגל שלך. */
export function matchInCircle(
  match: Match,
  legionnaires: Legionnaire[],
  followedTeams: string[],
  hiddenTeams: string[],
): boolean {
  return (
    inCircle(match.home.name, legionnaires, followedTeams, hiddenTeams) ||
    inCircle(match.away.name, legionnaires, followedTeams, hiddenTeams)
  );
}

/** תווית קצרה שמסבירה למה קבוצה במעגל. */
export function reasonLabel(reason: CircleReason): string {
  if (reason.legionnaire) return reason.legionnaire.name;
  if (reason.israeli) return 'ישראלית';
  return 'במעקב';
}

/**
 * רשימת שמות הקבוצות במעגל, בסדר קבוע: ישראליות, אחר כך מועדוני
 * לגיונרים, ואחר כך מה שהוספת ידנית. השמות הם כפי שמוגדרים אצלנו —
 * לא תלויים במה שהופיע בקאש היום, כדי שקבוצה בלי משחק היום עדיין
 * תופיע במסך עם "אין משחק קרוב".
 */
export function circleRoster(
  legionnaires: Legionnaire[],
  followedTeams: string[],
  hiddenTeams: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (name: string) => {
    if (!name || isHidden(name, hiddenTeams)) return;
    const key = normalize(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  for (const c of ISRAELI_CLUBS) add(c.provider);
  for (const p of legionnaires) add(p.club);
  for (const t of followedTeams) add(t);

  return out;
}
