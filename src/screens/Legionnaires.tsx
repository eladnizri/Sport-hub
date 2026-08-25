import { useMemo, useState } from 'react';
import { getLegionnaires } from '../data';
import { useFeed } from '../hooks/useFeed';
import { clockTime, countdown } from '../lib/format';
import type { LegionnaireReport } from '../lib/types';
import type { Prefs } from '../lib/prefs';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';

const STATUS_LABEL: Record<LegionnaireReport['status'], string> = {
  playing: 'על המגרש',
  played: 'סיים',
  bench: 'ספסל',
  upcoming: 'בהמשך',
  out: 'לא בסגל',
};

type Filter = 'all' | 'football' | 'basketball' | 'active';

export function Legionnaires({ prefs }: { prefs: Prefs }) {
  const [filter, setFilter] = useState<Filter>('all');
  const feed = useFeed(() => getLegionnaires(), prefs.autoRefresh ? 60000 : null, []);
  const reports = feed.data?.items ?? [];

  const filtered = useMemo(() => {
    if (filter === 'active') return reports.filter((r) => r.status === 'playing');
    if (filter === 'all') return reports;
    return reports.filter((r) => r.player.sport === filter);
  }, [reports, filter]);

  const totals = useMemo(
    () => ({
      playing: reports.filter((r) => r.status === 'playing').length,
      minutes: reports.reduce((s, r) => s + r.minutes, 0),
      goals: reports.reduce((s, r) => s + r.goals, 0),
      assists: reports.reduce((s, r) => s + r.assists, 0),
    }),
    [reports],
  );

  return (
    <>
      <PageHead eyebrow="מעקב ייעודי" title="לגיונרים" />

      <section className="card">
        <div className="card-head">
          <h2>סיכום הסבב</h2>
          <span className="meta">{reports.length} שחקנים במעקב</span>
        </div>
        <div className="grid-3">
          <div className="tile compact">
            <div className="label">דקות</div>
            <div className="value">{totals.minutes}</div>
            <div className="delta">סה״כ</div>
          </div>
          <div className="tile compact">
            <div className="label">שערים</div>
            <div className="value">{totals.goals}</div>
            <div className={`delta ${totals.goals ? 'pos' : ''}`}>{totals.goals ? 'רשת' : '—'}</div>
          </div>
          <div className="tile compact">
            <div className="label">בישולים</div>
            <div className="value">{totals.assists}</div>
            <div className={`delta ${totals.assists ? 'pos' : ''}`}>{totals.assists ? 'מסירות' : '—'}</div>
          </div>
        </div>
        {totals.playing > 0 && (
          <div className="banner" style={{ marginTop: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="b-title">
                {totals.playing === 1 ? 'לגיונר אחד על המגרש עכשיו' : `${totals.playing} לגיונרים על המגרש עכשיו`}
              </div>
              <div className="b-sub">הדקות מתעדכנות בזמן אמת</div>
            </div>
            <span className="badge live"><i className="live-dot" />חי</span>
          </div>
        )}
      </section>

      <div className="chip-row">
        {([
          ['all', 'הכל'],
          ['active', 'משחקים עכשיו'],
          ['football', 'כדורגל'],
          ['basketball', 'כדורסל'],
        ] as [Filter, string][]).map(([id, label]) => (
          <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>ביצועים</h2>
          <span className="meta">{filtered.length} מוצגים</span>
        </div>

        {feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 180 }} />
        ) : filtered.length === 0 ? (
          <p className="empty">אין לגיונרים בקטגוריה הזו</p>
        ) : (
          filtered.map((r) => (
            <div className="row" key={r.player.id} style={{ alignItems: 'flex-start' }}>
              <span className="avatar" style={{ background: r.player.accent }}>
                {r.player.name.split(' ')[0].slice(0, 2)}
              </span>
              <div className="r-main">
                <div className="r-title">{r.player.name}</div>
                <div className="r-sub">
                  {r.player.position} · {r.player.club} · מול {r.opponent}
                </div>
                <div className="stat-line">
                  {r.status === 'upcoming' ? (
                    <span className="stat-pill">{clockTime(r.kickoff)} · {countdown(r.kickoff)}</span>
                  ) : r.player.sport === 'basketball' ? (
                    <>
                      <span className="stat-pill">{r.minutes} דק׳</span>
                      <span className="stat-pill hot">{r.points} נק׳</span>
                      <span className="stat-pill">{r.rebounds} ריב׳</span>
                      <span className="stat-pill">{r.assists} אס׳</span>
                    </>
                  ) : (
                    <>
                      <span className="stat-pill">{r.minutes} דק׳</span>
                      {r.goals > 0 && <span className="stat-pill hot">{r.goals} שערים</span>}
                      {r.assists > 0 && <span className="stat-pill hot">{r.assists} בישולים</span>}
                      {r.rating !== null && <span className="stat-pill">ציון {r.rating.toFixed(1)}</span>}
                    </>
                  )}
                </div>
              </div>
              <div className="r-end">
                <span className={`badge ${r.status === 'playing' ? 'live' : r.status === 'played' ? 'green' : ''}`}>
                  {r.status === 'playing' && <i className="live-dot" />}
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      <p className="section-note">
        רשימת הלגיונרים נערכת בקובץ <code>src/data/legionnaires.ts</code>
      </p>
      <SourceNote feed={feed.data} />
    </>
  );
}
