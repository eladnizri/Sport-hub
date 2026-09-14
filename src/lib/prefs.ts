import type { CompetitionId, Legionnaire } from './types';
import { BROWSABLE, COMPETITIONS } from '../data/competitions';

export interface Prefs {
  competitions: CompetitionId[];
  /** לגיונרים שהוספת ידנית */
  customLegionnaires: Legionnaire[];
  /** לגיונרים שהוסתרו מהרשימה האוטומטית */
  hiddenLegionnaireIds: string[];
  /** קבוצות שהוספת ידנית למעגל המעקב, מעבר לישראליות ולמועדוני הלגיונרים */
  followedTeams: string[];
  /** קבוצות מהמעגל האוטומטי (ישראליות/לגיונרים) שהסרת */
  hiddenTeams: string[];
}

const KEY = 'sport-hub:prefs:v3';

export const DEFAULT_PREFS: Prefs = {
  competitions: BROWSABLE.map((c) => c.id),
  customLegionnaires: [],
  hiddenLegionnaireIds: [],
  followedTeams: [],
  hiddenTeams: [],
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const valid = new Set(COMPETITIONS.map((c) => c.id));
    const competitions = (parsed.competitions ?? DEFAULT_PREFS.competitions).filter((c) =>
      valid.has(c),
    );
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      // גרסה קודמת שמרה מזהי תחרויות שכבר לא קיימים; אם לא נשאר כלום
      // אחרי הסינון, חוזרים לברירת המחדל במקום להציג מסך ריק.
      competitions: competitions.length ? competitions : DEFAULT_PREFS.competitions,
      customLegionnaires: parsed.customLegionnaires ?? [],
      hiddenLegionnaireIds: parsed.hiddenLegionnaireIds ?? [],
      followedTeams: parsed.followedTeams ?? [],
      hiddenTeams: parsed.hiddenTeams ?? [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // מצב פרטי או אחסון חסום — האפליקציה ממשיכה עם ברירות המחדל
  }
}

/** החלק של ההעדפות שרלוונטי למיזוג רשימת הלגיונרים. */
export function legionPrefs(prefs: Prefs) {
  return { custom: prefs.customLegionnaires, hiddenIds: prefs.hiddenLegionnaireIds };
}
