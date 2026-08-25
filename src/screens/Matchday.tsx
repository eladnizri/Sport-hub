import { useMemo } from 'react';
import { getMatches } from '../data';
import { useFeed } from '../hooks/useFeed';
import { clockTime } from '../lib/format';
import type { Prefs } from '../lib/prefs';
import { COMPETITION_MAP } from '../data/competitions';
import { CloseIcon } from '../components/Icons';

/**
 * מצב יום משחק: תצוגה מרוכזת אחת לכל המשחקים הפעילים, מיועדת לימים
 * שבהם רצים כמה משחקים במקביל ואין זמן לנווט בין מסכים.
 */
export function Matchday({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const feed = useFeed(() => getMatches(prefs.competitions), 20000, [prefs.competitions.join(',')]);
  const matches = feed.data?.items ?? [];

  const { live, next } = useMemo(
    () => ({
      live: matches.filter((m) => m.status === 'live' || m.status === 'halftime'),
      next: matches.filter((m) => m.status === 'scheduled').slice(0, 4),
    }),
    [matches],
  );

  return (
    <div className="matchday">
      <div className="md-head">
        <button className="md-close" onClick={onClose} aria-label="סגור מצב יום משחק">
          <CloseIcon />
        </button>
        <div style={{ textAlign: 'right' }}>
          <h1>יום משחק</h1>
          <div className="md-sub">
            {live.length ? `${live.length} משחקים רצים במקביל` : 'אין משחקים חיים כרגע'}
          </div>
        </div>
      </div>

      {live.length > 0 ? (
        <div className="md-grid">
          {live.map((m) => (
            <div className="md-card" key={m.id}>
              <div className="md-comp">{COMPETITION_MAP[m.competition]?.short}</div>
              <div className="md-team">
                <span className="md-name">{m.home.name}</span>
                <span className="md-score">{m.home.score ?? '–'}</span>
              </div>
              <div className="md-team">
                <span className="md-name" style={{ opacity: 0.75 }}>{m.away.name}</span>
                <span className="md-score">{m.away.score ?? '–'}</span>
              </div>
              <div className="md-min">{m.clock}</div>
              {m.events[0] && (
                <div style={{ fontSize: 11.5, color: 'rgba(238,246,240,.55)', marginTop: 6 }}>
                  {`'${m.events[0].minute}`} · {m.events[0].text}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="md-card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 15, opacity: 0.7 }}>שקט בחזית. המסך יתמלא ברגע שמשחק ייצא לדרך.</div>
        </div>
      )}

      {next.length > 0 && (
        <>
          <div style={{ margin: '22px 4px 10px', fontSize: 14, fontWeight: 700, opacity: 0.65 }}>
            עולים לאוויר בהמשך
          </div>
          <div className="md-grid">
            {next.map((m) => (
              <div className="md-card" key={m.id}>
                <div className="md-comp">{COMPETITION_MAP[m.competition]?.short}</div>
                <div className="md-team"><span className="md-name">{m.home.name}</span></div>
                <div className="md-team"><span className="md-name" style={{ opacity: 0.75 }}>{m.away.name}</span></div>
                <div className="md-min">{clockTime(m.kickoff)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
