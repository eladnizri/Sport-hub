export type Sport = 'football' | 'basketball';

export type CompetitionId =
  | 'ligat-haal'
  | 'premier-league'
  | 'champions-league'
  | 'europa-conference'
  | 'nba'
  | 'euroleague';

export interface Competition {
  id: CompetitionId;
  name: string;
  short: string;
  sport: Sport;
  /**
   * מזהי הליגה אצל הספק. מערך, כי "מפעלים אירופיים" מאגד יותר מתחרות
   * אחת. הרץ `npm run leagues` כדי לשלוף את המזהים האמיתיים מהחשבון שלך.
   */
  providerIds?: number[];
  accent: string;
}

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export interface TeamSide {
  name: string;
  short: string;
  score: number | null;
  accent: string;
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
  /** minutes played for football, or elapsed game clock label for basketball */
  clock: string | null;
  kickoff: string; // ISO
  home: TeamSide;
  away: TeamSide;
  israeliInterest?: boolean;
  events: MatchEvent[];
  stats?: { label: string; home: number; away: number }[];
}

export interface Legionnaire {
  id: string;
  name: string;
  club: string;
  competition: CompetitionId;
  sport: Sport;
  position: string;
  accent: string;
}

export interface LegionnaireReport {
  player: Legionnaire;
  status: 'playing' | 'played' | 'bench' | 'upcoming' | 'out';
  opponent: string;
  minutes: number;
  goals: number;
  assists: number;
  /** football rating 0-10, or basketball efficiency */
  rating: number | null;
  points?: number;
  rebounds?: number;
  kickoff: string;
  note?: string;
}

export type TransferStage = 'rumor' | 'talks' | 'agreed' | 'done';

export interface TransferItem {
  id: string;
  player: string;
  sport: Sport;
  fromClub: string;
  toClub: string;
  stage: TransferStage;
  /** 1-5, how trustworthy the source is */
  reliability: number;
  source: string;
  fee: string | null;
  summary: string;
  publishedAt: string; // ISO
  competitions: CompetitionId[];
}

export interface FeedResult<T> {
  items: T[];
  /** where the data actually came from, surfaced in the UI so nothing is faked */
  source: 'live' | 'demo';
  fetchedAt: string;
  error?: string;
}
