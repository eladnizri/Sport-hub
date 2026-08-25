import type { FeedResult } from '../lib/types';

/**
 * שורת מקור. המסך תמיד אומר אם הנתונים חיים או הדגמה — כדי שלא יהיה
 * רגע שבו מספר דמו נראה כמו תוצאה אמיתית.
 */
export function SourceNote({ feed }: { feed: FeedResult<unknown> | null }) {
  if (!feed) return null;
  if (feed.source === 'live') {
    return <p className="section-note">נתונים חיים · עודכן {new Date(feed.fetchedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>;
  }
  return (
    <p className="section-note">
      נתוני הדגמה · חבר מפתח API בקובץ .env כדי לעבור ללייב אמיתי
      {feed.error ? ' (קריאת הספק נכשלה)' : ''}
    </p>
  );
}
