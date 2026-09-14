import { useMemo, useState } from 'react';
import { getLegionnaires, getMatches } from '../data';
import { useFeed } from '../hooks/useFeed';
import { greeting } from '../lib/format';
import { displayName } from '../data/competitions';
import { legionPrefs, type Prefs } from '../lib/prefs';
import { MatchCard } from '../components/MatchCard';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GearIcon, GridIcon } from '../components/Icons';
import type { TabId } from '../components/TabBar';

interface Props {
  prefs: Prefs;
  onOpenSettings: () => void;
  onOpenMatchday: () => void;
  onNavigate: (tab: TabId) => void;
}

export function Home({ prefs, onOpenSettings, onOpenMatchday, onNavigate }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const matchFeed = useFeed(
    () =>
      getMatches({
        competitions: prefs.competitions,
        followedTeams: prefs.followedTeams,
        allowLive: prefs.liveForMyMatches,
      }),
    prefs.autoRefresh ? 30000 : null,
    [prefs.competitions.join(','), prefs.liveForMyMatches],
  );
  const legionFeed = useFeed(
    () => getLegionnaires({ prefs: legionPrefs(prefs), allowLive: prefs.liveForMyMatches }),
    prefs.autoRefresh ? 60000 : null,
    [prefs.hiddenLegionnaireIds.join(','), prefs.liveForMyMatches],
  );

  const matches = matchFeed.data?.items ?? [];
  const reports = legionFeed.data?.items ?? [];

  const summary = useMemo(() => {
    const live = matches.filter((m) => m.status === 'live' || m.status === 'halftime');
    const upcoming = matches.filter((m) => m.status === 'scheduled');
    const israeli = matches.filter((m) => m.israeliInterest);
    const playing = reports.filter((r) => r.status === 'playing');
    const contributions = reports.reduce(
      (sum, r) => sum + (r.latest?.goals ?? 0) + (r.latest?.assists ?? 0),
      0,
    );
    return { live, upcoming, israeli, playing, contributions };
  }, [matches, reports]);

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

      <section className="card">
        <div className="card-head">
          <h2>מצב היום</h2>
          <span className="meta">
            {matchFeed.data ? new Date(matchFeed.data.fetchedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>

        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="tile">
            <div className="label">משחקים חיים</div>
            <div className="value">{summary.live.length}</div>
            <div className={`delta ${summary.live.length ? 'pos' : ''}`}>
              {summary.live.length ? 'רצים עכשיו' : 'אין כרגע'}
            </div>
          </div>
          <div className="tile">
            <div className="label">לגיונרים על המגרש</div>
            <div className="value">{summary.playing.length}</div>
            <div className={`delta ${summary.contributions ? 'pos' : ''}`}>
              {summary.contributions ? `+${summary.contributions} תרומות` : 'ללא תרומות'}
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="tile compact">
            <div className="label">היום</div>
            <div className="value">{matches.length}</div>
            <div className="delta">משחקים</div>
          </div>
          <div className="tile compact">
            <div className="label">ישראליות</div>
            <div className="value">{summary.israeli.length}</div>
            <div className="delta">משחקים</div>
          </div>
          <div className="tile compact">
            <div className="label">בהמשך</div>
            <div className="value">{summary.upcoming.length}</div>
            <div className="delta">טרם החלו</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{summary.live.length ? 'רץ עכשיו' : 'הבא בתור'}</h2>
          <span className="meta">
            {summary.live.length ? `${summary.live.length} חיים` : `${summary.upcoming.length} מתוכננים`}
          </span>
        </div>

        {summary.live.length >= 2 && (
          <button className="banner" onClick={onOpenMatchday} style={{ width: '100%', marginBottom: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="b-title">מצב יום משחק</div>
              <div className="b-sub">{summary.live.length} משחקים במקביל · מסך אחד</div>
            </div>
            <span className="b-value"><GridIcon /></span>
          </button>
        )}

        {matchFeed.loading && !matchFeed.data ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : (summary.live.length ? summary.live : summary.upcoming).slice(0, 4).length === 0 ? (
          <p className="empty">אין משחקים בליגות שבחרת היום</p>
        ) : (
          (summary.live.length ? summary.live : summary.upcoming).slice(0, 4).map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              spoilerFree={prefs.spoilerFree}
              revealed={revealed.has(m.id)}
              onToggle={toggle}
            />
          ))
        )}

        <button className="link-btn" style={{ marginTop: 14 }} onClick={() => onNavigate('live')}>
          לכל המשחקים ←
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>לגיונרים</h2>
          <button className="link-btn" onClick={() => onNavigate('legion')}>הכל ←</button>
        </div>
        {reports.slice(0, 3).map((r) => (
          <div className="row" key={r.player.id}>
            <span className="avatar" style={{ background: r.player.accent }}>
              {r.player.name.split(' ')[0].slice(0, 2)}
            </span>
            <div className="r-main">
              <div className="r-title">
                {r.player.name}
                {r.status === 'playing' && <i className="live-dot" />}
              </div>
              <div className="r-sub">{displayName(r.player.club)} · {r.standing}</div>
            </div>
            <div className="r-end">
              {r.trend === 'rising' ? (
                <span className="badge green">בעלייה</span>
              ) : r.trend === 'falling' ? (
                <span className="badge warm">בירידה</span>
              ) : (
                <span className="badge">{r.avgMinutes} דק׳ בממוצע</span>
              )}
            </div>
          </div>
        ))}
        {reports.length === 0 && <p className="empty">טוען תיקי לגיונרים…</p>}
      </section>

      <SourceNote feed={matchFeed.data} />
    </>
  );
}
