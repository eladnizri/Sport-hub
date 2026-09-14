/**
 * לקוח api-football לצד השרת.
 *
 * מקביל ל-src/data/providers/apiFootball.ts, אבל רץ ב-Node בתוך ה-Action
 * ולכן המפתח שלו הוא GitHub Secret שלא נוגע בדפדפן.
 */

const BASE = 'https://v3.football.api-sports.io';

export class ApiFootball {
  constructor(key, budget) {
    this.key = key;
    this.budget = budget;
  }

  async get(path, { cost = 1 } = {}) {
    if (!this.budget.can(cost)) {
      this.budget.skip(path);
      return null;
    }

    const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': this.key } });
    this.budget.spend(cost);

    if (res.status === 429) {
      // חרגנו מהמכסה היומית — סוגרים את התקציב כדי שההרצה תיעצר מסודר
      this.budget.used = this.budget.limit;
      console.warn('[api-football] נגמרה המכסה היומית (429)');
      return null;
    }
    if (!res.ok) {
      console.warn(`[api-football] ${res.status} עבור ${path}`);
      return null;
    }

    const body = await res.json();
    // הספק מחזיר 200 עם errors לא ריק כשמשהו לא תקין בבקשה
    const errors = body?.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
    if (hasErrors) {
      console.warn(`[api-football] שגיאת ספק עבור ${path}: ${JSON.stringify(errors)}`);
      return null;
    }

    return Array.isArray(body?.response) ? body.response : null;
  }

  /** כל המשחקים בתאריך נתון, בכל הליגות — קריאה אחת, סינון מקומי. */
  fixturesByDate(date) {
    return this.get(`/fixtures?date=${date}`);
  }

  /** משחקים חיים בליגות שבמעקב. */
  live(leagueIds) {
    return this.get(`/fixtures?live=${leagueIds.join('-')}`);
  }

  standings(leagueId, season) {
    return this.get(`/standings?league=${leagueId}&season=${season}`);
  }

  /** סטטיסטיקות שחקנים למשחק בודד — הבסיס להיסטוריית הלגיונרים. */
  fixturePlayers(fixtureId) {
    return this.get(`/fixtures/players?fixture=${fixtureId}`);
  }

  fixtureEvents(fixtureId) {
    return this.get(`/fixtures/events?fixture=${fixtureId}`);
  }

  /** סגל מועדון — משמש לזיהוי אוטומטי של ישראלים. */
  squad(teamId) {
    return this.get(`/players/squads?team=${teamId}`);
  }
}
