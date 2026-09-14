import type {
  LegionnaireAppearance,
  Legionnaire,
  Match,
  Standing,
  TransferItem,
} from '../../lib/types';

/**
 * הקאש הסטטי — מקור הנתונים הראשי של האפליקציה.
 *
 * GitHub Action מתוזמן מושך מ-api-football, כותב סיכומים, ומפרסם קובץ
 * JSON אחד יחד עם האתר. הדפדפן קורא רק את הקובץ: אין מפתח API בצד
 * הלקוח, אין חשיפה, והטעינה מיידית. קריאות חיות שמורות למשחקים
 * שסומנו כשלך (ראה src/lib/myMatches.ts).
 */

export interface Snapshot {
  /** מתי ה-Action בנה את הקובץ */
  builtAt: string;
  /** כמה קריאות api-football נשרפו בבנייה — שקיפות על התקציב */
  calls?: number;
  matches: Match[];
  standings: Standing[];
  /** היסטוריית הופעות מצטברת, לפי מזהה לגיונר */
  appearances: Record<string, LegionnaireAppearance[]>;
  /** לגיונרים שזוהו אוטומטית בצד השרת */
  legionnaires: Legionnaire[];
  transfers?: TransferItem[];
}

const EMPTY: Snapshot = {
  builtAt: '',
  matches: [],
  standings: [],
  appearances: {},
  legionnaires: [],
};

/**
 * הנתיב נבנה מול BASE_URL של Vite כדי שהאפליקציה תעבוד גם כשהיא
 * מוגשת מתת-נתיב, כמו ב-GitHub Pages.
 */
function snapshotUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/data/snapshot.json`;
}

let inflight: Promise<Snapshot | null> | null = null;
let cached: { at: number; value: Snapshot } | null = null;

/** כמה זמן מחזיקים את הקובץ בזיכרון לפני בקשה חוזרת. */
const MEMORY_TTL = 60_000;

export async function loadSnapshot(force = false): Promise<Snapshot | null> {
  if (!force && cached && Date.now() - cached.at < MEMORY_TTL) return cached.value;
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const res = await fetch(snapshotUrl(), { cache: force ? 'reload' : 'default' });
      if (!res.ok) return null;
      const body = (await res.json()) as Partial<Snapshot>;
      const value: Snapshot = { ...EMPTY, ...body };
      cached = { at: Date.now(), value };
      return value;
    } catch {
      // אין קאש עדיין (לפני ההרצה הראשונה של ה-Action) — נופלים לדמו
      return null;
    } finally {
      inflight = null;
    }
  })();

  inflight = request;
  return request;
}

export function hasSnapshot(): boolean {
  return cached !== null;
}
