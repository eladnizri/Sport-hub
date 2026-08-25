import type { CompetitionId } from './types';
import { COMPETITIONS } from '../data/competitions';

export interface Prefs {
  competitions: CompetitionId[];
  /** מרענן אוטומטית כשיש משחק חי */
  autoRefresh: boolean;
  /** מסתיר תוצאות עד שנוגעים בכרטיס */
  spoilerFree: boolean;
  /** קופץ ישירות למצב יום משחק כשרצים 3 משחקים ומעלה */
  autoMatchday: boolean;
}

const KEY = 'sport-hub:prefs:v1';

export const DEFAULT_PREFS: Prefs = {
  competitions: COMPETITIONS.map((c) => c.id),
  autoRefresh: true,
  spoilerFree: false,
  autoMatchday: false,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const valid = new Set(COMPETITIONS.map((c) => c.id));
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      competitions: (parsed.competitions ?? DEFAULT_PREFS.competitions).filter((c) => valid.has(c)),
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
