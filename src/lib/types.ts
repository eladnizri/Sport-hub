export type Sport = 'football' | 'basketball';

export type CompetitionId =
  | 'ligat-haal'
  | 'premier-league'
  | 'champions-league'
  | 'europa-league'
  | 'conference-league'
  | 'nba';

export interface Competition {
  id: CompetitionId;
  name: string;
  short: string;
  sport: Sport;
  /**
   * מזהי הליגה אצל הספק. מערך, כי תחרות אחת אצלנו יכולה לאגד יותר
   * ממזהה אחד אצל הספק. הרץ `npm run leagues` כדי לשלוף מזהים אמיתיים.
   */
  providerIds?: number[];
  /**
   * תחרות שמשמשת רק כהקשר ללגיונר ולא כליגה שגולשים בה. ה-NBA כאן רק
   * בשביל אבדיה — אין לה מסך טבלה, והיא לא נכנסת ללוח המשחקים היומי.
   */
  legionnaireOnly?: boolean;
  /** לתחרויות נוקאאוט אין טבלה קלאסית לאורך כל העונה. */
  hasTable?: boolean;
  accent: string;
}

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export interface TeamSide {
  name: string;
  short: string;
  score: number | null;
  accent: string;
  /** מזהה הקבוצה אצל הספק — הדבק שמחבר משחק לשורת טבלה וללגיונר. */
  providerId?: number;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'card' | 'sub' | 'var' | 'period';
  team: 'home' | 'away';
  text: string;
}

export interface Match {
  id: string;
  competition: CompetitionId;
  status: MatchStatus;
  /** דקות שנצברו בכדורגל, או תווית שעון משחק בכדורסל */
  clock: string | null;
  kickoff: string; // ISO
  home: TeamSide;
  away: TeamSide;
  israeliInterest?: boolean;
  events: MatchEvent[];
  stats?: { label: string; home: number; away: number }[];
  /** סיכום שלוש שורות למשחק שהסתיים. נאפה לקאש, או נבנה מתבנית. */
  narrative?: MatchNarrative;
}

/* ------------------------------------------------------------------ */
/* טבלה                                                                */
/* ------------------------------------------------------------------ */

export interface Standing {
  competition: CompetitionId;
  rank: number;
  teamId: number;
  team: string;
  short: string;
  accent: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** מחרוזת כושר מהספק, החדש ביותר בסוף: "WWDLW" */
  form: string | null;
  /** תיאור הקבוצה בטבלה אצל הספק — "Championship Round", "Promotion" וכו' */
  group?: string | null;
  /** תיאור המיקום: העפלה, פלייאוף, ירידה */
  marker?: string | null;
}

/**
 * שורת טבלה אחרי שהחלנו עליה את משחקי היום של הקבוצה.
 *
 * `rank` הוא המיקום אחרי היום: אם המשחק כבר הסתיים — התוצאה האמיתית;
 * אם עוד לא התחיל — הקרנה לפי ניצחון. `baseRank` הוא המיקום שממנו
 * יוצאים, לפני משחקי היום.
 */
export interface TableRow extends Standing {
  baseRank: number;
  basePoints: number;
  /** שערים לפני משחק היום — בסיס לחישוב תרחישים */
  baseGoalsFor: number;
  baseGoalsAgainst: number;
  /** חיובי = עלייה בטבלה */
  rankDelta: number;
  pointsDelta: number;
  /** משחק היום שמזיז את השורה הזאת, אם יש */
  todayMatchId?: string;
  /** תיאור עובדתי של משחק היום: "2-0 מול בית״ר" או "היום נגד בית״ר" */
  todayLabel?: string;
  /** true אם משחק היום כבר הסתיים; false אם עדיין לפניו */
  todayFinished?: boolean;
}

export interface TableScenario {
  competition: CompetitionId;
  /** משפט אחד: "ניצחון היום ומכבי חיפה עוברת למקום 2" */
  text: string;
  teamId: number;
  tone: 'up' | 'down' | 'hold';
  /** true אם התרחיש מתאר תוצאה שכבר קרתה, לא תחזית */
  realized: boolean;
}

/* ------------------------------------------------------------------ */
/* לגיונרים                                                            */
/* ------------------------------------------------------------------ */

export interface Legionnaire {
  id: string;
  name: string;
  club: string;
  /** מזהה הקבוצה אצל הספק, אם ידוע — מדייק את ההתאמה בין שחקן למשחק */
  clubId?: number;
  /** מזהה השחקן אצל הספק, אם ידוע */
  playerId?: number;
  /** התחרות שבה הכי מעניין לעקוב אחריו; לא חייבת להיות הליגה המקומית שלו */
  competition: CompetitionId;
  sport: Sport;
  position: string;
  accent: string;
  /** נוסף ידנית על ידי המשתמש ולא הגיע מהזיהוי האוטומטי */
  custom?: boolean;
  /** הוסתר ידנית מהרשימה האוטומטית */
  hidden?: boolean;
}

export interface LegionnaireAppearance {
  fixtureId: string;
  date: string; // ISO
  opponent: string;
  /** true אם המועדון של השחקן שיחק בחוץ */
  away: boolean;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
  points?: number;
  rebounds?: number;
}

export type LegionnaireTrend = 'rising' | 'steady' | 'falling' | 'unknown';

/**
 * התיק של הלגיונר — לא שורת סטטיסטיקה של המשחק האחרון אלא התשובה
 * לשאלה "הוא בדרך למעלה או למטה".
 */
export interface LegionnaireDossier {
  player: Legionnaire;
  status: 'playing' | 'played' | 'bench' | 'upcoming' | 'out' | 'unknown';
  /** המשחק הנוכחי או האחרון */
  latest: LegionnaireAppearance | null;
  /** חמשת המשחקים האחרונים, החדש ביותר ראשון */
  recent: LegionnaireAppearance[];
  /** ממוצע דקות בחמישייה האחרונה */
  avgMinutes: number;
  /** הרכבים פותחים מתוך חמשת האחרונים */
  starts: number;
  /** כיוון מגמת הדקות */
  trend: LegionnaireTrend;
  /** משפט אחד על המעמד: "שלושה הרכבים רצופים" */
  standing: string;
  /** המשחק הבא של המועדון שלו */
  next: { kickoff: string; opponent: string; competition: CompetitionId } | null;
  goals: number;
  assists: number;
}

/* ------------------------------------------------------------------ */
/* סיפור המשחק                                                         */
/* ------------------------------------------------------------------ */

export interface MatchNarrative {
  /** מה הכריע */
  verdict: string;
  /** מי בלט */
  standout: string;
  /** מה המשמעות לטבלה */
  meaning: string;
  /** 'ai' כשנכתב על ידי מודל שפה, 'template' כשנבנה מכללים */
  by: 'ai' | 'template';
}

/* ------------------------------------------------------------------ */
/* העברות                                                              */
/* ------------------------------------------------------------------ */

export type TransferStage = 'rumor' | 'talks' | 'agreed' | 'done';

export interface TransferItem {
  id: string;
  player: string;
  sport: Sport;
  fromClub: string;
  toClub: string;
  stage: TransferStage;
  /** 1-5, עד כמה המקור אמין */
  reliability: number;
  source: string;
  fee: string | null;
  summary: string;
  publishedAt: string; // ISO
  competitions: CompetitionId[];
}

/* ------------------------------------------------------------------ */
/* חדשות                                                                */
/* ------------------------------------------------------------------ */

export type NewsCategory = 'result' | 'table' | 'transfer' | 'headline';

/**
 * פריט בפיד הסקירה.
 *
 * שני מקורות מוזגים לאותו פיד: פריטים שנבנים מהנתונים שכבר יש לנו
 * (תוצאה, תנועה בטבלה, עדכון העברה) — source: 'generated' — וכותרות
 * אמיתיות שנשלפות מ-RSS בצד השרת, עם שם המקור. המסך תמיד מציג את
 * source כדי ששום דבר לא יתחזה לכתבה אמיתית.
 */
export interface NewsItem {
  id: string;
  category: NewsCategory;
  /** שורה אחת או שתיים, תלוי בקטגוריה */
  text: string;
  competition?: CompetitionId;
  /** שמות קבוצות (כפי שהספק מחזיר) שהפריט נוגע להן — למיון לפי מעגל המעקב */
  teams?: string[];
  publishedAt: string; // ISO
  source: 'generated' | string;
  url?: string;
}

/* ------------------------------------------------------------------ */
/* מצב קבוצה                                                           */
/* ------------------------------------------------------------------ */

/**
 * כרטיס "מה קורה" לקבוצה אחת — לא לייב, שלוש עובדות: איפה בטבלה,
 * מה קרה במשחק האחרון, מתי הבא. נבנה מעל הנתונים הקיימים, לא נשמר
 * בנפרד.
 */
export interface TeamStatus {
  /** שם הקבוצה כפי שהספק מחזיר */
  team: string;
  short: string;
  accent: string;
  teamId?: number;
  competition: CompetitionId;
  table: (TableRow & { gapText: string | null }) | null;
  lastResult: {
    opponent: string;
    scoreFor: number;
    scoreAgainst: number;
    date: string;
    outcome: 'win' | 'draw' | 'loss';
    home: boolean;
    /** סיכום שלוש השורות למשחק, אם יש */
    narrative: MatchNarrative | null;
  } | null;
  nextMatch: { opponent: string; kickoff: string; home: boolean } | null;
  scenario: TableScenario | null;
  legionnaire: LegionnaireDossier | null;
}

/* ------------------------------------------------------------------ */

/** מאיפה הנתונים באמת הגיעו, מוצג במסך כדי ששום מספר לא יתחזה לאמיתי. */
export type FeedSource = 'cache' | 'demo';

export interface FeedResult<T> {
  items: T[];
  source: FeedSource;
  fetchedAt: string;
  /** מתי הקאש נבנה בצד השרת — שונה מהרגע שבו הדפדפן קרא אותו */
  builtAt?: string;
  error?: string;
}
