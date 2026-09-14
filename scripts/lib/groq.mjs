/**
 * סיכומי שלוש שורות דרך Groq.
 *
 * המודל הוא Llama 3.3 70B — מודל פתוח שרץ על השכבה החינמית של Groq.
 * הקריאה נעשית כאן, בצד השרת, ולכן GROQ_API_KEY נשאר GitHub Secret.
 * כל משחק מסוכם פעם אחת ונשמר בקאש; אין קריאה חוזרת בכל טעינת דף.
 *
 * אם אין מפתח, או שהקריאה נכשלה, או שהמודל החזיר משהו שלא נראה כמו
 * שלוש השורות שביקשנו — מחזירים null, והאפליקציה נופלת לסיכום התבניתי
 * שרץ בדפדפן. עדיף משפט יבש נכון על משפט יפה שהומצא.
 */

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM = `אתה כותב סיכומי ספורט קצרים בעברית לאפליקציה אישית.
כללים מחייבים:
- החזר JSON בלבד, במבנה: {"verdict": "...", "standout": "...", "meaning": "..."}
- verdict: מה הכריע את המשחק. משפט אחד, עד 14 מילים.
- standout: מי בלט. משפט אחד, עד 12 מילים.
- meaning: מה המשמעות לטבלה. משפט אחד, עד 14 מילים.
- השתמש אך ורק בנתונים שקיבלת. אל תמציא שמות שחקנים, מספרים או אירועים.
- אם אין לך מספיק נתונים לשדה מסוים, כתוב בו משפט עובדתי על סמך התוצאה בלבד.
- עברית תקנית וזורמת, בלי סלנג ובלי סימני קריאה. בלי לפתוח ב"במשחק".`;

function buildPrompt(match, tableContext) {
  const goals = match.events
    .filter((e) => e.type === 'goal')
    .map((e) => `${e.minute}' ${e.text} (${e.team === 'home' ? match.home.name : match.away.name})`)
    .join('\n');

  const stats = (match.stats ?? [])
    .map((s) => `${s.label}: ${match.home.name} ${s.home} — ${match.away.name} ${s.away}`)
    .join('\n');

  return [
    `תוצאה: ${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}`,
    `תחרות: ${match.competition}`,
    goals ? `שערים:\n${goals}` : 'שערים: אין פירוט',
    stats ? `סטטיסטיקה:\n${stats}` : '',
    tableContext ? `הקשר טבלה:\n${tableContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parse(content) {
  if (typeof content !== 'string') return null;
  // המודל עשוי לעטוף ב-```json — מחלצים את גוף האובייקט
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const { verdict, standout, meaning } = obj;
    if (typeof verdict !== 'string' || typeof standout !== 'string' || typeof meaning !== 'string') {
      return null;
    }
    if (!verdict.trim() || !standout.trim() || !meaning.trim()) return null;
    return {
      verdict: verdict.trim(),
      standout: standout.trim(),
      meaning: meaning.trim(),
      by: 'ai',
    };
  } catch {
    return null;
  }
}

export async function summarize(match, tableContext, key) {
  if (!key) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildPrompt(match, tableContext) },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[groq] ${res.status} — נופלים לסיכום תבניתי`);
      return null;
    }

    const body = await res.json();
    return parse(body?.choices?.[0]?.message?.content);
  } catch (err) {
    console.warn(`[groq] קריאה נכשלה: ${err} — נופלים לסיכום תבניתי`);
    return null;
  }
}
