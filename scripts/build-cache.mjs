#!/usr/bin/env node
/**
 * בונה את הקאש הסטטי שהאפליקציה קוראת.
 *
 * רץ בתוך GitHub Action לפי לוח זמנים, מושך מ-api-football בתוך תקציב
 * קריאות קשיח, מסכם משחקים שהסתיימו עם Groq, וכותב קובץ JSON אחד:
 *   public/data/snapshot.json
 *
 * היסטוריית הופעות הלגיונרים נצברת בין הרצות (public/data/history.json),
 * כדי שלא נשלם קריאות על אותו משחק פעמיים — ולכן מגמת הדקות משתפרת עם
 * הזמן במקום להתאפס בכל הרצה.
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

  /* --- טבלאות: רק כשיש טעם, ורק אם נשאר תקציב --- */

  const standings = [];
  const season = seasonFor(now);

  // הטבלה זזה רק אחרי שמשחק נגמר. אם מאז ההרצה הקודמת לא הסתיים כלום,
  // אין סיבה לשלם עליה שוב — לוקחים את מה שכבר יש.
  const finishedNow = [...matches.values()].filter((m) => m.status === 'finished');
  const knownFinished = new Set(
    (previous?.matches ?? []).filter((m) => m.status === 'finished').map((m) => m.id),
  );
  const somethingEnded = finishedNow.some((m) => !knownFinished.has(m.id));
  const staleTable =
    !previous?.standings?.length ||
    !previous?.builtAt ||
    now.getTime() - new Date(previous.builtAt).getTime() > 12 * 3600 * 1000;

  if (somethingEnded || staleTable) {
    for (const comp of COMPETITIONS) {
      if (!comp.hasTable) continue;
      if (!budget.can(1)) {
        budget.skip(`טבלה ${comp.id}`);
        continue;
      }
      const rows = await api.standings(comp.leagueIds[0], season);
      const groups = rows?.[0]?.league?.standings ?? [];
      for (const group of groups) {
        for (const row of group) standings.push(mapStandingRow(row, comp.id));
      }
    }
  }

  // תחרות שלא נמשכה בהרצה הזאת שומרת על הטבלה הקודמת שלה
  const fetched = new Set(standings.map((s) => s.competition));
  for (const s of previous?.standings ?? []) {
    if (!fetched.has(s.competition)) standings.push(s);
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

  /* --- כתיבה --- */

  const snapshot = {
    builtAt: now.toISOString(),
    calls: budget.used,
    matches: [...matches.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    standings,
    appearances: trimHistory(history),
    legionnaires: [],
    transfers: previous?.transfers ?? [],
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(snapshot), 'utf8');
  await writeFile(HISTORY, JSON.stringify(snapshot.appearances), 'utf8');

  console.log(
    `[cache] ${snapshot.matches.length} משחקים · ${standings.length} שורות טבלה · ` +
      `${written} סיכומים חדשים · ${budget.used}/${budget.limit} קריאות`,
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
