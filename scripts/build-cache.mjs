#!/usr/bin/env node
/**
 * בונה את הקאש הסטטי שהאפליקציה קוראת — זו אפליקציית סקירה, לא מעקב
 * חי, ולכן הקאש הזה הוא מקור הנתונים היחיד; הדפדפן לא קורא לשום ספק.
 *
 * רץ בתוך GitHub Action לפי לוח זמנים, מושך מ-api-football בתוך תקציב
 * קריאות קשיח, מושך כותרות מ-RSS, מסכם משחקים שהסתיימו עם Groq, וכותב
 * קובץ JSON אחד: public/data/snapshot.json
 *
 * שני חוזים חשובים ששאר הקוד (src/lib/table.ts, src/lib/news.ts)
 * נשען עליהם:
 *  1. standings משקף תמיד את המצב *לפני* משחקי היום — ולכן מתעדכן
 *     לכל היותר פעם ביום לכל תחרות, לא בתגובה מיידית למשחק שהסתיים.
 *  2. היסטוריית הופעות הלגיונרים נצברת בין הרצות (public/data/history.json),
 *     כדי שלא נשלם קריאות על אותו משחק פעמיים.
 *
 * הרצה מקומית:
 *   API_FOOTBALL_KEY=xxx GROQ_API_KEY=yyy npm run cache
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Budget } from './lib/budget.mjs';
import { ApiFootball } from './lib/apiFootball.mjs';
import { summarize } from './lib/groq.mjs';
import { fetchRss } from './lib/rss.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const SNAPSHOT = join(OUT_DIR, 'snapshot.json');
const HISTORY = join(OUT_DIR, 'history.json');

/* ------------------------------------------------------------------ */
/* תצורה                                                               */
/* ------------------------------------------------------------------ */

/** חייב להישאר מסונכרן עם src/data/competitions.ts */
const COMPETITIONS = [
  { id: 'ligat-haal', leagueIds: [383], hasTable: true },
  { id: 'premier-league', leagueIds: [39], hasTable: true },
  { id: 'champions-league', leagueIds: [2], hasTable: true },
  { id: 'europa-league', leagueIds: [3], hasTable: true },
  { id: 'conference-league', leagueIds: [848], hasTable: true },
];

const LEAGUE_TO_COMP = new Map(
  COMPETITIONS.flatMap((c) => c.leagueIds.map((id) => [id, c.id])),
);

const ISRAELI_CLUBS = [
  'Maccabi Tel Aviv', 'Maccabi Haifa', 'Hapoel Beer Sheva', 'Hapoel Tel Aviv',
  'Beitar Jerusalem', 'Maccabi Netanya', 'Hapoel Jerusalem', 'Maccabi Bnei Raina',
  'Hapoel Haifa', 'Ironi Kiryat Shmona', 'Bnei Sakhnin', 'Ashdod',
  'Hapoel Petah Tikva', 'Hapoel Hadera',
];

/**
 * מועדוני הלגיונרים שאנחנו מושכים להם סטטיסטיקות שחקנים.
 * השמות מושווים בהשוואה סלחנית מול מה שהספק מחזיר.
 */
const LEGIONNAIRES = [
  { id: 'lg-solomon', name: 'מנור סולומון', club: 'Villarreal', providerName: 'Manor Solomon' },
  { id: 'lg-gloukh', name: 'אוסקר גלוך', club: 'RB Salzburg', providerName: 'Oscar Gloukh' },
  { id: 'lg-abada', name: 'ליאל אבדה', club: 'Charlotte', providerName: 'Liel Abada' },
  { id: 'lg-khalaili', name: 'אנאן ח׳לאילי', club: 'Slavia Praha', providerName: 'Anan Khalaili' },
  { id: 'lg-peretz', name: 'דור פרץ', club: 'AEK Athens', providerName: 'Dor Peretz' },
];

/** התקציב להרצה בודדת. ההרצה נעצרת בשקט כשהוא נגמר. */
const CALL_BUDGET = Number(process.env.CALL_BUDGET ?? 18);

/** כמה משחקים מסכמים עם מודל שפה בכל הרצה. */
const SUMMARY_BUDGET = Number(process.env.SUMMARY_BUDGET ?? 6);

/**
 * פיד/י RSS לכותרות אמיתיות. לא אומתו מול המקורות בזמן הכתיבה — הרשת
 * מהסביבה שבה זה נכתב חסומה לדומיינים חיצוניים, ולכן ייתכן שכתובת כאן
 * לא תעבוד או שהפורמט שלה השתנה. הפרסר (scripts/lib/rss.mjs) נכשל
 * בשקט אם כתובת לא עובדת — הדיגסט הנבנה מהנתונים ממשיך לרוץ בלעדיה.
 * בדוק את הכתובות, ותקן/הוסף כאן אם צריך.
 */
const NEWS_FEEDS = (process.env.NEWS_FEEDS || 'https://www.one.co.il/Rss/RssItem.aspx?FolderID=698')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((url) => ({ url, source: hostnameOf(url) }));

/** כמה כותרות שומרים בקאש בסך הכל, אחרי סינון וסינון-רלוונטיות. */
const NEWS_LIMIT = 15;

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'חדשות';
  }
}

/**
 * מילות מפתח לסינון רלוונטיות מכותרת חדשות כללית. פיד ישראלי כללי
 * מכיל הרבה שלא קשור לכדורגל שאנחנו עוקבים אחריו — הכותרת עצמה
 * בעברית, ולכן הסינון כאן בעברית ולא מול שמות הספק באנגלית.
 */
const NEWS_KEYWORDS = [
  'כדורגל', 'ליגת העל', 'ליגת האלופות', 'פרמייר ליג', 'ליגה האירופית', 'ליגת הקונפרנס',
  'מכבי תל אביב', 'מכבי חיפה', 'הפועל באר שבע', 'הפועל תל אביב', 'בית"ר ירושלים',
  'מכבי נתניה', 'הפועל ירושלים', 'בני סכנין', 'עירוני קרית שמונה',
  ...LEGIONNAIRES.map((p) => p.name),
];

function isRelevantHeadline(title) {
  return NEWS_KEYWORDS.some((k) => title.includes(k));
}

/* ------------------------------------------------------------------ */
/* עזרים                                                               */
/* ------------------------------------------------------------------ */

function normalize(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(FC|CF|AFC|SC|SK|AS|CD|BK)\b/gi, '')
    .replace(/[^a-z0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sameClub(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

const ISRAELI_SET = new Set(ISRAELI_CLUBS.map(normalize));
const isIsraeli = (name) => ISRAELI_SET.has(normalize(name));

function accentFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 42%)`;
}

function shortName(name) {
  const clean = String(name).replace(/\b(FC|CF|AFC|SC)\b/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return clean.slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** עונת כדורגל אירופית נפתחת באוגוסט, ולכן ינואר-יוני שייכים לשנה הקודמת. */
function seasonFor(d) {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

const LIVE_CODES = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE_CODES = new Set(['FT', 'AET', 'PEN']);

function mapStatus(short) {
  if (short === 'HT') return 'halftime';
  if (LIVE_CODES.has(short)) return 'live';
  if (DONE_CODES.has(short)) return 'finished';
  if (['PST', 'CANC', 'ABD', 'SUSP'].includes(short)) return 'postponed';
  return 'scheduled';
}

function mapFixture(fx, competition) {
  const status = mapStatus(fx.fixture.status.short);
  const elapsed = fx.fixture.status.elapsed;

  return {
    id: `af-${fx.fixture.id}`,
    competition,
    status,
    clock:
      status === 'halftime' ? 'מחצית'
      : status === 'finished' ? 'סיום'
      : elapsed ? `'${elapsed}` : null,
    kickoff: fx.fixture.date,
    home: {
      name: fx.teams.home.name,
      short: shortName(fx.teams.home.name),
      score: fx.goals.home,
      accent: accentFor(fx.teams.home.name),
      providerId: fx.teams.home.id,
    },
    away: {
      name: fx.teams.away.name,
      short: shortName(fx.teams.away.name),
      score: fx.goals.away,
      accent: accentFor(fx.teams.away.name),
      providerId: fx.teams.away.id,
    },
    israeliInterest: isIsraeli(fx.teams.home.name) || isIsraeli(fx.teams.away.name),
    events: [],
  };
}

function mapEvents(rows, fixture) {
  return (rows ?? [])
    .filter((e) => e.type === 'Goal' || e.type === 'Card')
    .map((e) => ({
      minute: e.time?.elapsed ?? 0,
      type: e.type === 'Goal' ? 'goal' : 'card',
      team: e.team?.name === fixture.home.name ? 'home' : 'away',
      text: `${e.detail ?? ''} · ${e.player?.name ?? ''}`.trim(),
    }))
    .sort((a, b) => b.minute - a.minute);
}

function mapStandingRow(row, competition) {
  return {
    competition,
    rank: row.rank,
    teamId: row.team.id,
    team: row.team.name,
    short: shortName(row.team.name),
    accent: accentFor(row.team.name),
    played: row.all.played,
    won: row.all.win,
    drawn: row.all.draw,
    lost: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    points: row.points,
    form: row.form ?? null,
    group: row.group ?? null,
    marker: row.description ?? null,
  };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* בניית הקאש                                                          */
/* ------------------------------------------------------------------ */

async function main() {
  const key = process.env.API_FOOTBALL_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!key) {
    console.error('חסר API_FOOTBALL_KEY — אין מה למשוך. הקאש הקיים נשאר במקומו.');
    process.exit(1);
  }

  const budget = new Budget(CALL_BUDGET);
  const api = new ApiFootball(key, budget);
  const now = new Date();

  const previous = await readJson(SNAPSHOT, null);
  const history = await readJson(HISTORY, {});

  /* --- משחקים: היום ומחר, קריאה אחת לכל תאריך --- */

  const leagueIds = COMPETITIONS.flatMap((c) => c.leagueIds);
  const wanted = new Set(leagueIds);
  const matches = new Map();

  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  for (const day of [isoDate(now), isoDate(tomorrow)]) {
    const rows = await api.fixturesByDate(day);
    if (!rows) continue;
    for (const fx of rows) {
      if (!wanted.has(fx.league?.id)) continue;
      const comp = LEAGUE_TO_COMP.get(fx.league.id);
      matches.set(`af-${fx.fixture.id}`, mapFixture(fx, comp));
    }
  }

  /* --- משחקים חיים: קריאה אחת, מחליפה את גרסת הלוח --- */

  const liveRows = await api.live(leagueIds);
  for (const fx of liveRows ?? []) {
    const comp = LEAGUE_TO_COMP.get(fx.league?.id);
    if (!comp) continue;
    matches.set(`af-${fx.fixture.id}`, mapFixture(fx, comp));
  }

  // משחקים מהקאש הקודם שעדיין רלוונטיים (למשל אתמול בלילה) נשמרים,
  // כדי שהיסטוריית המשחקים האחרונים לא תיעלם בין הרצות
  const cutoff = now.getTime() - 36 * 3600 * 1000;
  for (const m of previous?.matches ?? []) {
    if (matches.has(m.id)) continue;
    if (new Date(m.kickoff).getTime() >= cutoff) matches.set(m.id, m);
  }

  /* --- טבלאות: פעם ביום לכל תחרות, לא יותר --- */

  // חוזה חשוב: standings חייב לשקף את המצב *לפני* משחקי היום, כי
  // src/lib/table.ts מחיל עליו את תוצאות היום בצד הלקוח. אם היינו
  // מרעננים את הטבלה מיד אחרי שמשחק נגמר — באותה הרצה שבה נמשך גם
  // המשחק עצמו — הטבלה הטרייה כבר הייתה כוללת אותו, וההחלה בצד הלקוח
  // הייתה סופרת אותו פעמיים. לכן טבלה מתעדכנת לכל היותר פעם ביום,
  // בהרצה הראשונה של אותו יום — ולא בתגובה למשחק שהסתיים.
  const standings = [];
  const season = seasonFor(now);
  const today = isoDate(now);
  const standingsDates = { ...(previous?.standingsDates ?? {}) };

  for (const comp of COMPETITIONS) {
    if (!comp.hasTable) continue;

    if (standingsDates[comp.id] === today) {
      // כבר רועננה היום — משתמשים במה שיש
      for (const s of previous?.standings ?? []) {
        if (s.competition === comp.id) standings.push(s);
      }
      continue;
    }

    if (!budget.can(1)) {
      budget.skip(`טבלה ${comp.id}`);
      // לא רועננה, אבל עדיין צריך למלא מהקאש הקודם כדי שהמסך לא יתרוקן
      for (const s of previous?.standings ?? []) {
        if (s.competition === comp.id) standings.push(s);
      }
      continue;
    }

    const rows = await api.standings(comp.leagueIds[0], season);
    const groups = rows?.[0]?.league?.standings ?? [];
    for (const group of groups) {
      for (const row of group) standings.push(mapStandingRow(row, comp.id));
    }
    standingsDates[comp.id] = today;
  }

  /* --- אירועים וסטטיסטיקות שחקנים: רק למשחקים שמעניינים אותך --- */

  const tracked = [...matches.values()].filter(
    (m) => m.israeliInterest || LEGIONNAIRES.some((p) => sameClub(m.home.name, p.club) || sameClub(m.away.name, p.club)),
  );

  // משחק שכבר עובד בהרצה קודמת לא נמשך שוב — כך העלות לאורך זמן קטנה
  const processed = new Set(
    Object.values(history).flat().map((a) => a.fixtureId),
  );

  for (const match of tracked) {
    if (match.status !== 'finished') continue;
    if (processed.has(match.id)) continue;
    if (!budget.can(2)) {
      budget.skip(`פרטי משחק ${match.id}`);
      break;
    }

    const fixtureId = match.id.replace(/^af-/, '');

    const events = await api.fixtureEvents(fixtureId);
    if (events) match.events = mapEvents(events, match);

    const players = await api.fixturePlayers(fixtureId);
    if (players) recordAppearances(players, match, history);
  }

  // אירועים של משחקים שכבר עובדו בעבר נשמרים מהקאש הקודם
  const previousById = new Map((previous?.matches ?? []).map((m) => [m.id, m]));
  for (const match of matches.values()) {
    if (match.events.length) continue;
    const before = previousById.get(match.id);
    if (before?.events?.length) match.events = before.events;
  }

  /* --- סיכומים: משחקים שהסתיימו ועדיין אין להם אחד --- */

  const summarized = new Map(
    (previous?.matches ?? []).filter((m) => m.narrative).map((m) => [m.id, m.narrative]),
  );

  let written = 0;
  for (const match of [...matches.values()].sort(sortByInterest)) {
    if (match.status !== 'finished') continue;

    const cachedNarrative = summarized.get(match.id);
    if (cachedNarrative) {
      match.narrative = cachedNarrative;
      continue;
    }
    if (written >= SUMMARY_BUDGET || !groqKey) continue;

    const narrative = await summarize(match, tableContext(match, standings), groqKey);
    if (narrative) {
      match.narrative = narrative;
      written++;
    }
  }

  /* --- כותרות אמיתיות מ-RSS --- */

  // לא תלוי בתקציב api-football כלל — מקור נפרד, נכשל בשקט לבד
  const rawHeadlines = (
    await Promise.all(NEWS_FEEDS.map(({ url, source }) => fetchRss(url).then((items) => items.map((i) => ({ ...i, source })))))
  ).flat();

  const seenLinks = new Set();
  const news = rawHeadlines
    .filter((h) => isRelevantHeadline(h.title))
    .filter((h) => {
      const key = h.link ?? h.title;
      if (seenLinks.has(key)) return false;
      seenLinks.add(key);
      return true;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, NEWS_LIMIT)
    .map((h, i) => ({
      id: `rss-${h.source}-${i}-${new Date(h.publishedAt).getTime()}`,
      category: 'headline',
      text: h.title,
      publishedAt: h.publishedAt,
      source: h.source,
      url: h.link ?? undefined,
    }));

  /* --- כתיבה --- */

  const snapshot = {
    builtAt: now.toISOString(),
    calls: budget.used,
    matches: [...matches.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    standings,
    // מתי כל תחרות רועננה לאחרונה — לא חלק מהחוזה שהאפליקציה קוראת,
    // רק מצב פנימי של הסקריפט בין הרצות
    standingsDates,
    appearances: trimHistory(history),
    legionnaires: [],
    transfers: previous?.transfers ?? [],
    news,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(snapshot), 'utf8');
  await writeFile(HISTORY, JSON.stringify(snapshot.appearances), 'utf8');

  console.log(
    `[cache] ${snapshot.matches.length} משחקים · ${standings.length} שורות טבלה · ` +
      `${written} סיכומים חדשים · ${news.length} כותרות · ${budget.used}/${budget.limit} קריאות`,
  );
}

/** משחקים שמעניינים אותך מסוכמים קודם, כשתקציב הסיכומים מוגבל. */
function sortByInterest(a, b) {
  if (Boolean(a.israeliInterest) !== Boolean(b.israeliInterest)) {
    return a.israeliInterest ? -1 : 1;
  }
  return b.kickoff.localeCompare(a.kickoff);
}

/** שורת ההקשר שנכנסת לפרומפט — בלעדיה המודל ימציא מיקומים בטבלה. */
function tableContext(match, standings) {
  const rows = standings.filter((s) => s.competition === match.competition);
  if (!rows.length) return '';
  const lines = [];
  for (const side of [match.home, match.away]) {
    const row = rows.find((r) => r.teamId === side.providerId);
    if (row) lines.push(`${row.team}: מקום ${row.rank}, ${row.points} נקודות`);
  }
  return lines.join('\n');
}

/** ממיר את תגובת fixtures/players להופעות של הלגיונרים שבמעקב. */
function recordAppearances(payload, match, history) {
  for (const teamBlock of payload ?? []) {
    const teamName = teamBlock?.team?.name;
    const isHome = teamBlock?.team?.id === match.home.providerId;
    const opponent = isHome ? match.away.name : match.home.name;

    for (const entry of teamBlock?.players ?? []) {
      const player = LEGIONNAIRES.find(
        (p) => sameClub(teamName, p.club) && sameClub(entry?.player?.name, p.providerName),
      );
      if (!player) continue;

      const stats = entry?.statistics?.[0];
      if (!stats) continue;

      const appearance = {
        fixtureId: match.id,
        date: match.kickoff,
        opponent,
        away: !isHome,
        started: Boolean(stats.games?.substitute === false),
        minutes: stats.games?.minutes ?? 0,
        goals: stats.goals?.total ?? 0,
        assists: stats.goals?.assists ?? 0,
        rating: stats.games?.rating ? Number(stats.games.rating) : null,
      };

      history[player.id] = history[player.id] ?? [];
      if (!history[player.id].some((a) => a.fixtureId === appearance.fixtureId)) {
        history[player.id].push(appearance);
      }
    }
  }
}

/** שומרים חלון קצר לכל שחקן — התיק מסתכל על חמישה משחקים בלבד. */
function trimHistory(history) {
  const out = {};
  for (const [id, rows] of Object.entries(history)) {
    out[id] = [...rows]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);
  }
  return out;
}

main().catch((err) => {
  console.error('[cache] ההרצה נכשלה:', err);
  process.exit(1);
});
