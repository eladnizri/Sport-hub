import type { Match } from '../lib/types';
import { COMPETITION_MAP } from '../data/competitions';
import { clockTime, countdown } from '../lib/format';

interface Props {
  match: Match;
  spoilerFree: boolean;
  revealed: boolean;
  onToggle: (id: string) => void;
  showStats?: boolean;
}

function Crest({ short, accent }: { short: string; accent: string }) {
  return <span className="crest" style={{ background: accent }}>{short}</span>;
}

export function MatchCard({ match, spoilerFree, revealed, onToggle, showStats }: Props) {
  const comp = COMPETITION_MAP[match.competition];
  const isLive = match.status === 'live' || match.status === 'halftime';
  const hidden = spoilerFree && !revealed && match.status !== 'scheduled';

  const renderScore = (value: number | null) => {
    if (hidden) return '•';
    if (value === null) return '–';
    return value;
  };

  return (
    <button className={`match${isLive ? ' is-live' : ''}`} onClick={() => onToggle(match.id)}>
      <div className="match-top">
        <span className="match-comp">{comp?.short ?? match.competition}</span>
        {isLive ? (
          <span className="badge live"><i className="live-dot" />{hidden ? 'חי' : match.clock}</span>
        ) : match.status === 'finished' ? (
          <span className="badge">סיום</span>
        ) : match.status === 'postponed' ? (
          <span className="badge warm">נדחה</span>
        ) : (
          <span className="badge">{clockTime(match.kickoff)}</span>
        )}
      </div>

      <div className="score-line">
        <div className="side">
          <Crest short={match.home.short} accent={match.home.accent} />
          <span className="name">{match.home.name}</span>
        </div>
        <span className="score">{renderScore(match.home.score)}</span>
      </div>

      <div className="score-line">
        <div className="side">
          <Crest short={match.away.short} accent={match.away.accent} />
          <span className="name dim">{match.away.name}</span>
        </div>
        <span className="score">{renderScore(match.away.score)}</span>
      </div>

      {match.status === 'scheduled' && (
        <div className="bar-legend"><span>{countdown(match.kickoff)}</span><span>{comp?.name}</span></div>
      )}

      {showStats && match.stats && !hidden && (
        <div style={{ marginTop: 4 }}>
          {match.stats.map((s) => {
            const total = s.home + s.away || 1;
            return (
              <div key={s.label} style={{ marginTop: 8 }}>
                <div className="bar"><i style={{ width: `${(s.home / total) * 100}%` }} /></div>
                <div className="bar-legend">
                  <span>{s.home}</span><span>{s.label}</span><span>{s.away}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showStats && !hidden && match.events.length > 0 && (
        <div className="stat-line">
          {match.events.slice(0, 4).map((e, i) => (
            <span key={i} className={`stat-pill${e.type === 'goal' ? ' hot' : ''}`}>
              {`'${e.minute}`} {e.text}
            </span>
          ))}
        </div>
      )}

      {hidden && <div className="bar-legend"><span>הקש לחשיפת התוצאה</span></div>}
    </button>
  );
}
