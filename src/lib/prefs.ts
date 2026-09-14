import type { CompetitionId, Legionnaire } from './types';
import { BROWSABLE, COMPETITIONS } from '../data/competitions';

export interface Prefs {
  competitions: CompetitionId[];
  /** מרענן אוטומטית כשיש משחק חי */
  autoRefresh: boolean;
  /** מסתיר תוצאות עד שנוגעים בכרטיס */
  spoilerFree: boolean;
  /** קופץ ישירות למצב יום משחק כשרצים 3 משחקים ומעלה */
  autoMatchday: boolean;
  /**
   * מרשה פוליניג חי מהדפדפן למשחקים שסומנו כשלך. כיבוי מבטיח שהאפליקציה
   * לא תשרוף אף קריאת API מעבר למה שה-Action כבר שרף.
   */
  liveForMyMatches: boolean;
  /** לגיונרים שהוספת ידנית */
  customLegionnaires: Legionnaire[];
  /** לגיונרים שהוסתרו מהרשימה האוטומטית */
  hiddenLegionnaireIds: string[];
  /** קבוצות שסימנת במעקב — שמות כפי שהספק מחזיר אותם */
  followedTeams: string[];
}

const KEY = 'sport-hub:prefs:v2';

export const DEFAULT_PREFS: Prefs = {
  competitions: BROWSABLE.map((c) => c.id),
  autoRefresh: true,
  spoilerFree: false,
  autoMatchday: false,
  liveForMyMatches: true,
  customLegionnaires: [],
  hiddenLegionnaireIds: [],
  followedTeams: [],
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

/** החלק של ההעדפות שרלוונטי לשכבת הנתונים. */
export function legionPrefs(prefs: Prefs) {
  return { custom: prefs.customLegionnaires, hiddenIds: prefs.hiddenLegionnaireIds };
}
