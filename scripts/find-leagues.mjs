#!/usr/bin/env node
/**
 * שולף את מזהי הליגות האמיתיים מחשבון API-Football שלך.
 *
 *   npm run leagues
 *
 * מזהי ליגות יכולים להשתנות בין ספקים ובין תוכניות, ולכן במקום לסמוך על
 * מספרים קשיחים — הרץ את זה פעם אחת והדבק את מה שמודפס אל
 * src/data/competitions.ts (השדה providerIds).
 */
import { readFileSync } from 'node:fs';

function readEnvKey() {
  if (process.env.VITE_API_FOOTBALL_KEY) return process.env.VITE_API_FOOTBALL_KEY;
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('VITE_API_FOOTBALL_KEY='));
    return line ? line.split('=').slice(1).join('=').trim() : '';
  } catch {
    return '';
  }
}

const key = readEnvKey();
if (!key) {
  console.error('\nלא נמצא מפתח. צור קובץ .env עם VITE_API_FOOTBALL_KEY=... ונסה שוב.\n');
  process.exit(1);
}

// מה שאנחנו מחפשים -> איך זה נקרא אצל הספק
const WANTED = [
  { label: 'ליגת העל', search: 'Ligat', country: 'Israel' },
  { label: 'הפרמייר ליג', search: 'Premier League', country: 'England' },
  { label: 'ליגת האלופות', search: 'Champions League', country: 'World' },
  { label: 'ליגה אירופית', search: 'Europa League', country: 'World' },
  { label: 'קונפרנס ליג', search: 'Conference League', country: 'World' },
];

async function lookup({ label, search, country }) {
  const url = `https://v3.football.api-sports.io/leagues?search=${encodeURIComponent(search)}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': key } });

  if (res.status === 499 || res.status === 401 || res.status === 403) {
    throw new Error(`המפתח נדחה (HTTP ${res.status}). ודא שהעתקת את המפתח המלא מהדשבורד.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length) {
    throw new Error(JSON.stringify(body.errors));
  }

  const hits = (body.response ?? [])
    .filter((r) => !country || r.country?.name === country)
    .map((r) => ({ id: r.league.id, name: r.league.name, country: r.country?.name }));

  console.log(`\n${label}  (חיפוש: "${search}")`);
  if (!hits.length) {
    console.log('  לא נמצא — נסה חיפוש אחר, או שהתוכנית שלך לא כוללת את הליגה הזו.');
    return;
  }
  for (const h of hits) console.log(`  ${String(h.id).padStart(5)}  ${h.name} · ${h.country}`);
}

console.log('שולף מזהי ליגות מ-API-Football…');
let failed = false;
for (const w of WANTED) {
  try {
    await lookup(w);
  } catch (err) {
    failed = true;
    console.error(`\n${w.label}: ${err.message}`);
  }
}

console.log(`
─────────────────────────────────────────────
העתק את המזהים אל src/data/competitions.ts, לשדה providerIds.
"מפעלים אירופיים" מקבל שני מזהים: [ליגה אירופית, קונפרנס ליג].
`);

process.exit(failed ? 1 : 0);
