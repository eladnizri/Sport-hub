import type {
  LegionnaireAppearance,
  Legionnaire,
  Match,
  NewsItem,
  Standing,
  TransferItem,
} from '../../lib/types';

/**
 * הקאש הסטטי — מקור הנתונים היחיד של האפליקציה.
 *
 * GitHub Action מתוזמן מושך מ-api-football ומ-RSS, כותב סיכומים,
 * ומפרסם קובץ JSON אחד יחד עם האתר. הדפדפן קורא רק את הקובץ: אין
 * מפתח API בצד הלקוח, אין חשיפה, והטעינה מיידית. זו אפליקציית סקירה
 * ולא מעקב חי — אין שום קריאה חוזרת לספק מהדפדפן.
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
  /** כותרות אמיתיות מ-RSS, אם המקור היה זמין בזמן הבנייה */
  news?: NewsItem[];
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
let cached: { at: number; value: Snapshot | null } | null = null;

/**
 * כמה זמן מחזיקים את הקובץ בזיכרון לפני בקשה חוזרת. זו אפליקציית
 * סקירה שמתעדכנת בקאש כמה פעמים ביום — אין טעם לבדוק שוב תוך דקה.
 */
const MEMORY_TTL = 10 * 60_000;

/**
 * גם "אין קאש" נשמר, אבל לזמן קצר בלבד: בלי זה כל מסך שנטען מבקש
 * שוב את הקובץ ומקבל 404 — חמש בקשות מיותרות בטעינה אחת. הזמן הקצר
 * מבטיח שברגע שה-Action מפרסם קאש, האפליקציה תרים אותו בלי לרענן.
 */
const MISS_TTL = 60_000;

export async function loadSnapshot(force = false): Promise<Snapshot | null> {
  if (!force && cached) {
    const ttl = cached.value ? MEMORY_TTL : MISS_TTL;
    if (Date.now() - cached.at < ttl) return cached.value;
  }
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const res = await fetch(snapshotUrl(), { cache: force ? 'reload' : 'default' });
      if (!res.ok) {
        cached = { at: Date.now(), value: null };
        return null;
      }
      const body = (await res.json()) as Partial<Snapshot>;
      const value: Snapshot = { ...EMPTY, ...body };
      cached = { at: Date.now(), value };
      return value;
    } catch {
      // אין קאש עדיין (לפני ההרצה הראשונה של ה-Action) — נופלים לדמו
      cached = { at: Date.now(), value: null };
      return null;
    } finally {
      inflight = null;
    }
  })();

  inflight = request;
  return request;
}

export function hasSnapshot(): boolean {
  return cached?.value != null;
}
