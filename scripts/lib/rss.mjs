/**
 * פרסר RSS זעיר, בלי תלות חיצונית — regex על XML גולמי, לא DOM parser
 * מלא. תומך ב-RSS 2.0 הבסיסי (title/link/pubDate/description בתוך
 * <item>), שזה כל מה שרוב פיד החדשות הישראליים מספקים.
 *
 * כל כשל — רשת, פורמט לא מוכר, פיד שהוריד את הכתובת — מחזיר מערך ריק
 * בלי לזרוק. כותרות אמיתיות הן תוספת לפיד הסקירה, לא תלות שלו: אם
 * המקור נופל, הדיגסט הנבנה מהנתונים עדיין עומד לבד.
 */

export async function fetchRss(url, { limit = 25, timeoutMs = 8000 } = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[rss] ${url} — HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseItems(xml).slice(0, limit);
    if (!items.length) console.warn(`[rss] ${url} — אין <item> בתגובה, ייתכן שהפורמט השתנה`);
    return items;
  } catch (err) {
    console.warn(`[rss] ${url} נכשל: ${err}`);
    return [];
  }
}

function parseItems(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const items = [];

  for (const block of blocks) {
    const title = tag(block, 'title');
    if (!title) continue;
    const link = tag(block, 'link');
    const pubDate = tag(block, 'pubDate') ?? tag(block, 'dc:date');
    const parsed = pubDate ? new Date(pubDate) : null;

    items.push({
      title: decode(title),
      link: link ? decode(link).trim() : null,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString(),
    });
  }

  return items;
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  if (!m) return null;
  return m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}
