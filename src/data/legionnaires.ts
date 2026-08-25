import type { Legionnaire } from '../lib/types';

/**
 * רשימת הלגיונרים במעקב.
 *
 * זהו קובץ תצורה שנועד לעריכה ידנית. שיוך שחקן למועדון משתנה בכל חלון
 * העברות, ולכן הרשימה כאן היא נקודת פתיחה בלבד — ודא מול מקור עדכני
 * לפני שאתה נשען עליה, ועדכן שורות כאן כשלגיונר עובר מועדון.
 *
 * השדה club מושווה מול שמות הקבוצות שמגיעים מספק הנתונים, בהשוואה
 * סלחנית (הכלה דו-כיוונית), כך ש-"Portland" יתאים גם ל-"Portland Trail
 * Blazers". אם שחקן לא מזוהה — התאם את השם לזה שהספק מחזיר.
 */
export const LEGIONNAIRES: Legionnaire[] = [
  { id: 'lg-solomon', name: 'מנור סולומון', club: 'Villarreal', competition: 'champions-league', sport: 'football', position: 'כנף', accent: '#f5c518' },
  { id: 'lg-gloukh', name: 'אוסקר גלוך', club: 'RB Salzburg', competition: 'champions-league', sport: 'football', position: 'קשר התקפי', accent: '#c8102e' },
  { id: 'lg-abada', name: 'ליאל אבדה', club: 'Charlotte FC', competition: 'premier-league', sport: 'football', position: 'כנף', accent: '#1a85c8' },
  { id: 'lg-khalaili', name: 'אנאן ח׳לאילי', club: 'Slavia Prague', competition: 'europa-conference', sport: 'football', position: 'כנף', accent: '#8b1e2d' },
  { id: 'lg-peretz', name: 'דור פרץ', club: 'AEK Athens', competition: 'europa-conference', sport: 'football', position: 'קשר', accent: '#f2c200' },
  { id: 'lg-avdija', name: 'דני אבדיה', club: 'Portland Trail Blazers', competition: 'nba', sport: 'basketball', position: 'פורוורד', accent: '#c0492f' },
];
