import { useMemo, useState } from 'react';
import { getTransfers } from '../data';
import { useFeed } from '../hooks/useFeed';
import { relativeTime } from '../lib/format';
import type { Prefs } from '../lib/prefs';
import type { TransferStage } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';

const STAGE: Record<TransferStage, { label: string; cls: string }> = {
  rumor: { label: 'שמועה', cls: 'warm' },
  talks: { label: 'מגעים', cls: '' },
  agreed: { label: 'סוכם', cls: 'green' },
  done: { label: 'הושלם', cls: 'green' },
};

type Filter = 'all' | 'football' | 'basketball' | 'confirmed' | 'israeli-relevant';

export function Radar({ prefs }: { prefs: Prefs }) {
  const [filter, setFilter] = useState<Filter>('all');
  const feed = useFeed(() => getTransfers(), prefs.autoRefresh ? 120000 : null, []);
  const items = feed.data?.items ?? [];

  const filtered = useMemo(() => {
    const base = items.filter((t) => t.competitions.some((c) => prefs.competitions.includes(c)));
    if (filter === 'all') return base;
    if (filter === 'confirmed') return base.filter((t) => t.stage === 'agreed' || t.stage === 'done');
    if (filter === 'israeli-relevant') return base.filter((t) => t.reliability >= 4);
    return base.filter((t) => t.sport === filter);
  }, [items, filter, prefs.competitions]);

  const hot = items.filter((t) => t.stage === 'done' || t.stage === 'agreed').length;

  return (
    <>
      <PageHead eyebrow="שוק ההעברות" title="רדאר" />

      <section className="card">
        <div className="card-head">
          <h2>מצב השוק</h2>
          <span className="meta">{items.length} עדכונים</span>
        </div>
        <div className="grid-3">
          <div className="tile compact">
            <div className="label">סגורות</div>
            <div className="value">{hot}</div>
            <div className="delta pos">אושרו</div>
          </div>
          <div className="tile compact">
            <div className="label">במגעים</div>
            <div className="value">{items.filter((t) => t.stage === 'talks').length}</div>
            <div className="delta">מתפתח</div>
          </div>
          <div className="tile compact">
            <div className="label">שמועות</div>
            <div className="value">{items.filter((t) => t.stage === 'rumor').length}</div>
            <div className="delta">לא מאומת</div>
          </div>
        </div>
      </section>

      <div className="chip-row">
        {([
          ['all', 'הכל'],
          ['confirmed', 'רק מאושרות'],
          ['israeli-relevant', 'מקורות אמינים'],
          ['football', 'כדורגל'],
          ['basketball', 'NBA'],
        ] as [Filter, string][]).map(([id, label]) => (
          <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>פיד חי</h2>
          <span className="meta">{filtered.length} מוצגים</span>
        </div>

        {feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : filtered.length === 0 ? (
          <p className="empty">אין עדכונים שתואמים לסינון</p>
        ) : (
          filtered.map((t) => {
            const stage = STAGE[t.stage];
            return (
              <div className="row" key={t.id} style={{ alignItems: 'flex-start' }}>
                <div className="r-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${stage.cls}`}>{stage.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{relativeTime(t.publishedAt)}</span>
                  </div>
                  <div className="r-title">{t.player}</div>
                  <div className="r-sub">
                    {t.fromClub} ← {t.toClub}
                    {t.fee ? ` · ${t.fee}` : ''}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.55 }}>
                    {t.summary}
                  </div>
                  <div className="stat-line">
                    <span className="stat-pill">{t.source}</span>
                    <span className={`stat-pill${t.reliability >= 4 ? ' hot' : ''}`}>
                      אמינות {'★'.repeat(t.reliability)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <SourceNote feed={feed.data} />
    </>
  );
}
