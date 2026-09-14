import type { Legionnaire, Match } from './types';
import { isIsraeliClub } from '../data/competitions';
import { playsIn } from './dossier';

/**
 * "משחק שלי" — משחק שמצדיק לשרוף עליו קריאת API חיה.
 *
 * תקציב הקריאות מוגבל (השכבה החינמית של api-football נותנת 100 ביום),
 * ולכן פוליניג חי לא רץ על כל משחק אלא רק על מה שבאמת מעניין: קבוצה
 * ישראלית, מועדון של לגיונר במעקב, או קבוצה שסימנת ידנית.
 */

export interface MyMatchReason {
  israeli: boolean;
  legionnaire: Legionnaire | null;
  followed: boolean;
}

export function reasonFor(
  match: Match,
  legionnaires: Legionnaire[],
  followedTeams: string[],
): MyMatchReason | null {
  const israeli = isIsraeliClub(match.home.name) || isIsraeliClub(match.away.name);
  const legionnaire = legionnaires.find((p) => playsIn(p, match)) ?? null;
  const followedSet = new Set(followedTeams);
  const followed = followedSet.has(match.home.name) || followedSet.has(match.away.name);

  if (!israeli && !legionnaire && !followed) return null;
  return { israeli, legionnaire, followed };
}

export function isMine(
  match: Match,
  legionnaires: Legionnaire[],
  followedTeams: string[],
): boolean {
  return reasonFor(match, legionnaires, followedTeams) !== null;
}

/** תווית קצרה שמסבירה למה המשחק סומן. */
export function reasonLabel(reason: MyMatchReason): string {
  if (reason.legionnaire) return reason.legionnaire.name;
  if (reason.israeli) return 'עניין ישראלי';
  return 'במעקב';
}
