import type { FeedResult } from '../lib/types';

/**
 * שורת מקור. המסך תמיד אומר מתי הנתונים עודכנו לאחרונה — לא מתי
 * הדפדפן טען אותם, אלא מתי הקאש נבנה בצד השרת — כדי שברור עד כמה
 * הסקירה טרייה. אם אין קאש עדיין, אומר את זה במפורש במקום להתחזות.
 */
export function SourceNote({ feed }: { feed: FeedResult<unknown> | null }) {
  if (!feed) return null;

  if (feed.source === 'demo') {
    return (
      <p className="section-note">
        נתוני הדגמה · ה-Action עדיין לא רץ, או שאין לו מפתח API
      </p>
    );
  }

  const time = feed.builtAt
    ? new Date(feed.builtAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  return <p className="section-note">{time ? `עודכן לאחרונה בשעה ${time}` : 'עודכן לאחרונה'}</p>;
}
