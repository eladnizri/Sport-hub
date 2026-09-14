import { useMemo, useState } from 'react';
import { getNews } from '../data';
import { useFeed } from '../hooks/useFeed';
import { greeting, relativeTime } from '../lib/format';
import { legionPrefs, type Prefs } from '../lib/prefs';
import type { NewsCategory, NewsItem } from '../lib/types';
import { competitionName } from '../data/competitions';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GearIcon, RadarIcon, ShieldIcon, TableIcon } from '../components/Icons';
import type { TabId } from '../components/TabBar';

/**
 * מסך הסקירה — הבית של האפליקציה.
 *
 * לא לוח תוצאות, אלא פיד: מה קרה, מה זז בטבלה, מה קורה בשוק ההעברות.
 * ברירת המחדל היא סיכומים שנבנים מהנתונים שכבר יש לנו; כותרות אמיתיות
 * מ-RSS מתמזגות לאותו פיד כשהן קיימות, עם שם המקור גלוי.
 */

const FILTERS: { id: NewsCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'result', label: 'תוצאות' },
  { id: 'table', label: 'טבלה' },
  { id: 'transfer', label: 'העברות' },
  { id: 'headline', label: 'כותרות' },
];

function CategoryMark({ category }: { category: NewsCategory }) {
  if (category === 'transfer') return <RadarIcon className="news-mark" />;
  if (category === 'table') return <TableIcon className="news-mark" />;
  if (category === 'result') return <ShieldIcon className="news-mark" />;
  return null;
}

function NewsCard({ item }: { item: NewsItem }) {
  const isLink = item.source !== 'generated' && item.url;
  const body = (
    <>
      <div className="news-top">
        <span className="news-cat">
          <CategoryMark category={item.category} />
          {item.competition ? competitionName(item.competition) : sourceLabel(item.category)}
        </span>
        <span className="news-time">{relativeTime(item.publishedAt)}</span>
      </div>
      <p className="news-text">{item.text}</p>
      {item.source !== 'generated' && <span className="news-source">מקור: {item.source}</span>}
    </>
  );

  if (isLink) {
    return (
      <a className="news-item" href={item.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }
  return <div className="news-item">{body}</div>;
}

function sourceLabel(category: NewsCategory): string {
  if (category === 'transfer') return 'שוק ההעברות';
  if (category === 'table') return 'טבלה';
  if (category === 'result') return 'תוצאה';
  return 'כותרת';
}

interface Props {
  prefs: Prefs;
  onOpenSettings: () => void;
  onNavigate: (tab: TabId) => void;
}

export function Overview({ prefs, onOpenSettings, onNavigate }: Props) {
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');

  const feed = useFeed(
    () =>
      getNews({
        legionnaires: legionPrefs(prefs),
        followedTeams: prefs.followedTeams,
        hiddenTeams: prefs.hiddenTeams,
      }),
    null,
    [
      prefs.followedTeams.join(','),
      prefs.hiddenTeams.join(','),
      prefs.hiddenLegionnaireIds.join(','),
      prefs.customLegionnaires.length,
    ],
  );

  const items = feed.data?.items ?? [];

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <>
      <PageHead
        eyebrow="חמ״ל ספורט"
        title={greeting()}
        action={
          <button className="icon-btn" onClick={onOpenSettings} aria-label="הגדרות">
            <GearIcon />
          </button>
        }
      />

      <div className="chip-row">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? items.length : counts[f.id] ?? 0;
          if (f.id !== 'all' && count === 0) return null;
          return (
            <button
              key={f.id}
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}{count ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>מה קרה</h2>
          <span className="meta">{filtered.length} עדכונים</span>
        </div>

        {feed.loading && !feed.data ? (
          <>
            <div className="skeleton" style={{ height: 70, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 70 }} />
          </>
        ) : filtered.length === 0 ? (
          <p className="empty">
            {items.length === 0
              ? 'אין עדיין עדכונים למעגל שלך. הוסף קבוצות ולגיונרים ממסך הקבוצות.'
              : 'אין עדכונים בקטגוריה הזאת כרגע'}
          </p>
        ) : (
          filtered.map((item) => <NewsCard key={item.id} item={item} />)
        )}

        {items.length > 0 && (
          <button className="link-btn" style={{ marginTop: 14 }} onClick={() => onNavigate('teams')}>
            למצב כל הקבוצות ←
          </button>
        )}
      </section>

      <SourceNote feed={feed.data} />
    </>
  );
}
