import type { Legionnaire } from '../lib/types';

/**
 * רשימת הלגיונרים.
 *
 * הרשימה נבנית משתי שכבות:
 *  1. הבסיס כאן — נקודת פתיחה שמתעדכנת עם הקוד.
 *  2. הקאש — שחקנים שה-Action מזהה אוטומטית (עדיין לא ממומש; ראה
 *     `legionnaires: []` הקבוע ב-scripts/build-cache.mjs — הסריקה
 *     דורשת עבור על סגלי קבוצות ועלולה לייקר את התקציב).
 * ומעליהן שכבה שלישית: עריכות ידניות שלך, שנשמרות במכשיר
 * (src/lib/prefs.ts) ומנצחות תמיד — הוספה של שחקן שלא זוהה אוטומטית,
 * והסתרה של מי שכבר לא מעניין. כרגע זו הדרך היחידה לעדכן את הרשימה.
 *
 * שיוך שחקן למועדון משתנה בכל חלון העברות. השכבה האוטומטית נועדה בדיוק
 * לכך; אם שחקן מופיע במועדון הלא נכון, ערוך אותו מהאפליקציה במקום
 * לתקן כאן.
 */
export const BASE_LEGIONNAIRES: Legionnaire[] = [
  { id: 'lg-solomon', name: 'מנור סולומון', club: 'Villarreal', competition: 'champions-league', sport: 'football', position: 'כנף', accent: '#f5c518' },
  { id: 'lg-gloukh', name: 'אוסקר גלוך', club: 'RB Salzburg', competition: 'champions-league', sport: 'football', position: 'קשר התקפי', accent: '#c8102e' },
  { id: 'lg-abada', name: 'ליאל אבדה', club: 'Charlotte FC', competition: 'premier-league', sport: 'football', position: 'כנף', accent: '#1a85c8' },
  { id: 'lg-khalaili', name: 'אנאן ח׳לאילי', club: 'Slavia Praha', competition: 'conference-league', sport: 'football', position: 'כנף', accent: '#8b1e2d' },
  { id: 'lg-peretz', name: 'דור פרץ', club: 'AEK Athens', competition: 'conference-league', sport: 'football', position: 'קשר', accent: '#f2c200' },
  { id: 'lg-avdija', name: 'דני אבדיה', club: 'Portland Trail Blazers', competition: 'nba', sport: 'basketball', position: 'פורוורד', accent: '#c0492f' },
];

/**
 * מיזוג שלוש השכבות לרשימה אחת.
 * עריכה ידנית דורסת רשומה עם אותו id, והסתרה מוציאה אותה לגמרי.
 */
export function mergeLegionnaires(
  base: Legionnaire[],
  detected: Legionnaire[],
  custom: Legionnaire[],
  hiddenIds: string[],
): Legionnaire[] {
  const byId = new Map<string, Legionnaire>();
  for (const p of [...base, ...detected, ...custom]) {
    byId.set(p.id, { ...byId.get(p.id), ...p });
  }
  const hidden = new Set(hiddenIds);
  return [...byId.values()]
    .filter((p) => !hidden.has(p.id) && !p.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}
