import type { Competition, CompetitionId } from '../lib/types';

/**
 * התחרויות שהאפליקציה עוקבת אחריהן.
 *
 * ה-NBA מסומן legionnaireOnly: הוא קיים רק כהקשר לאבדיה, ולא נכנס ללוח
 * המשחקים היומי ולא מקבל מסך טבלה. אם תרצה NBA מלא בהמשך — הסר את הדגל.
 */
export const COMPETITIONS: Competition[] = [
  { id: 'ligat-haal', name: 'ליגת העל', short: 'ליגת העל', sport: 'football', providerIds: [383], hasTable: true, accent: '#2f7a5a' },
  { id: 'premier-league', name: 'הפרמייר ליג', short: 'פרמייר ליג', sport: 'football', providerIds: [39], hasTable: true, accent: '#4b3f9e' },
  { id: 'champions-league', name: 'ליגת האלופות', short: 'אלופות', sport: 'football', providerIds: [2], hasTable: true, accent: '#1f4f8a' },
  { id: 'europa-league', name: 'הליגה האירופית', short: 'אירופה', sport: 'football', providerIds: [3], hasTable: true, accent: '#c07c2c' },
  { id: 'conference-league', name: 'ליגת הקונפרנס', short: 'קונפרנס', sport: 'football', providerIds: [848], hasTable: true, accent: '#3f8f8f' },
  { id: 'nba', name: 'NBA', short: 'NBA', sport: 'basketball', legionnaireOnly: true, accent: '#c0492f' },
];

export const COMPETITION_MAP: Record<CompetitionId, Competition> = Object.fromEntries(
  COMPETITIONS.map((c) => [c.id, c]),
) as Record<CompetitionId, Competition>;

/** התחרויות שגולשים בהן — בלי אלה שקיימות רק כהקשר ללגיונר. */
export const BROWSABLE = COMPETITIONS.filter((c) => !c.legionnaireOnly);

export const TABLE_COMPETITIONS = COMPETITIONS.filter((c) => c.hasTable);

/**
 * מועדונים ישראליים, בשמות שהספק מחזיר ובשם העברי להצגה.
 * משמש גם לסימון "עניין ישראלי" וגם לתרגום שמות במסך.
 */
export const ISRAELI_CLUBS: { provider: string; he: string }[] = [
  { provider: 'Maccabi Tel Aviv', he: 'מכבי תל אביב' },
  { provider: 'Maccabi Haifa', he: 'מכבי חיפה' },
  { provider: 'Hapoel Beer Sheva', he: 'הפועל באר שבע' },
  { provider: 'Hapoel Tel Aviv', he: 'הפועל תל אביב' },
  { provider: 'Beitar Jerusalem', he: 'בית"ר ירושלים' },
  { provider: 'Maccabi Netanya', he: 'מכבי נתניה' },
  { provider: 'Hapoel Jerusalem', he: 'הפועל ירושלים' },
  { provider: 'Maccabi Bnei Raina', he: 'מכבי בני ריינה' },
  { provider: 'Hapoel Haifa', he: 'הפועל חיפה' },
  { provider: 'Ironi Kiryat Shmona', he: 'עירוני קרית שמונה' },
  { provider: 'Bnei Sakhnin', he: 'בני סכנין' },
  { provider: 'Ashdod', he: 'מ.ס. אשדוד' },
  { provider: 'Hapoel Petah Tikva', he: 'הפועל פתח תקווה' },
  { provider: 'Hapoel Hadera', he: 'הפועל חדרה' },
];

/**
 * מילון שמות להצגה. הספק מחזיר אנגלית; כאן מתרגמים את מה שמופיע הרבה
 * על המסך. שם שלא מופיע כאן מוצג כפי שהגיע — עדיף שם אנגלי נכון על
 * תעתיק שגוי.
 */
const DISPLAY_NAMES: Record<string, string> = {
  ...Object.fromEntries(ISRAELI_CLUBS.map((c) => [normalize(c.provider), c.he])),
  [normalize('Manchester City')]: 'מנצ׳סטר סיטי',
  [normalize('Manchester United')]: 'מנצ׳סטר יונייטד',
  [normalize('Liverpool')]: 'ליברפול',
  [normalize('Arsenal')]: 'ארסנל',
  [normalize('Chelsea')]: 'צ׳לסי',
  [normalize('Tottenham')]: 'טוטנהאם',
  [normalize('Newcastle')]: 'ניוקאסל',
  [normalize('Aston Villa')]: 'אסטון וילה',
  [normalize('Real Madrid')]: 'ריאל מדריד',
  [normalize('Barcelona')]: 'ברצלונה',
  [normalize('Atletico Madrid')]: 'אתלטיקו מדריד',
  [normalize('Bayern Munchen')]: 'באיירן מינכן',
  [normalize('Bayern Munich')]: 'באיירן מינכן',
  [normalize('Borussia Dortmund')]: 'בורוסיה דורטמונד',
  [normalize('Paris Saint Germain')]: 'פ.ס.ז׳',
  [normalize('Inter')]: 'אינטר',
  [normalize('AC Milan')]: 'מילאן',
  [normalize('Juventus')]: 'יובנטוס',
  [normalize('Napoli')]: 'נאפולי',
  [normalize('Benfica')]: 'בנפיקה',
  [normalize('Porto')]: 'פורטו',
  [normalize('Ajax')]: 'אייאקס',
  [normalize('Salzburg')]: 'זלצבורג',
  [normalize('Slavia Praha')]: 'סלאביה פראג',
  [normalize('AEK Athens')]: 'אא״ק אתונה',
  [normalize('Villarreal')]: 'ויאריאל',
};

/** משווים שמות בלי רעש: בלי ניקוד, בלי FC/CF, באותיות קטנות. */
export function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(FC|CF|AFC|SC|SK|AS|CD|BK)\b/gi, '')
    .replace(/[^a-z0-9\u0590-\u05ff ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** שם להצגה בעברית, אם יש לנו כזה. */
export function displayName(providerName: string): string {
  return DISPLAY_NAMES[normalize(providerName)] ?? providerName;
}

const ISRAELI_SET = new Set(ISRAELI_CLUBS.map((c) => normalize(c.provider)));

export function isIsraeliClub(name: string): boolean {
  return ISRAELI_SET.has(normalize(name));
}

/**
 * השוואת שמות מועדונים סלחנית: הספקים לא תמיד מסכימים על הצורה
 * המלאה ("Portland" מול "Portland Trail Blazers"), ולכן בודקים הכלה
 * דו-כיוונית על השם המנורמל, לא שוויון מדויק.
 */
export function clubNamesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function competitionName(id: CompetitionId): string {
  return COMPETITION_MAP[id]?.name ?? id;
}

/** מזהה הליגה אצל הספק -> התחרות שלנו. */
export function competitionForProviderId(leagueId: number): CompetitionId | null {
  const hit = COMPETITIONS.find((c) => c.providerIds?.includes(leagueId));
  return hit ? hit.id : null;
}

/** צבע יציב לקבוצה, כדי שהסמלים לא יקפצו בין רינדורים. */
export function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}

/** ראשי תיבות קצרים לסמל הקבוצה. */
export function shortName(name: string): string {
  const he = displayName(name);
  const clean = he.replace(/\b(FC|CF|AFC|SC)\b/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return clean.slice(0, 3);
  return words.slice(0, 3).map((w) => w[0]).join('');
}
