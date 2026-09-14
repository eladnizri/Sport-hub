import { useMemo, useState } from 'react';
import { getTableView } from '../data';
import { useFeed } from '../hooks/useFeed';
import { buildLiveTable, buildScenarios } from '../lib/liveTable';
import { displayName, TABLE_COMPETITIONS } from '../data/competitions';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId, LiveTableRow } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';

/**
 * הטבלה החיה.
 *
 * שורת הטבלה מציגה את המיקום המוקרן — איפה הקבוצה תהיה אם המשחקים
 * שרצים כרגע ייגמרו בתוצאתם הנוכחית — לצד החץ שמראה מאיפה היא הגיעה.
 * זה ההבדל בין טבלה שמתעדכנת אחרי המחזור לטבלה שזזה תוך כדי.
 */

function FormDots({ form }: { form: string | null }) {
  if (!form) return null;
  // הספק מחזיר את החדש ביותר בסוף; בעברית נוח לקרוא את החדש ראשון
  const recent = form.slice(-5).split('').reverse();
  return (
    <span className="form-dots" aria-label={`כושר אחרון: ${recent.join('')}`}>
      {recent.map((r, i) => (
        <i key={i} className={`form-dot ${r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'}`} />
      ))}
    </span>
  );
}

function MoveArrow({ delta }: { delta: number }) {
  if (delta === 0) return <span className="move flat">·</span>;
  return (
    <span className={`move ${delta > 0 ? 'up' : 'down'}`}>
      {delta > 0 ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  );
}

function Row({ row, highlight }: { row: LiveTableRow; highlight: boolean }) {
  const moving = row.liveMatchId != null;
  return (
    <tr className={`${moving ? 'is-live-row' : ''}${highlight ? ' is-mine' : ''}`}>
      <td className="rank">
        <div className="rank-inner">
          <span>{row.rank}</span>
          {moving && <MoveArrow delta={row.rankDelta} />}
        </div>
      </td>
      <td className="team">
        <div className="team-inner">
          <span className="crest sm" style={{ background: row.accent }}>{row.short}</span>
          <div className="team-text">
            <span className="team-name">{displayName(row.team)}</span>
            {row.liveLabel ? (
              <span className="team-sub live">{row.liveLabel}</span>
            ) : row.marker ? (
              <span className="team-sub">{row.marker}</span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="num dim">{row.played}</td>
      <td className="num dim">{row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}</td>
      <td className="num pts">
        {row.points}
        {row.pointsDelta > 0 && <i className="pts-delta">+{row.pointsDelta}</i>}
      </td>
      <td className="form-cell"><FormDots form={row.form} /></td>
    </tr>
  );
}

export function Table({ prefs }: { prefs: Prefs }) {
  const available = TABLE_COMPETITIONS.filter((c) => prefs.competitions.includes(c.id));
  const [selected, setSelected] = useState<CompetitionId | null>(null);
  const active = selected && available.some((c) => c.id === selected)
    ? selected
    : available[0]?.id ?? null;

  const feed = useFeed(
    () =>
      getTableView({
        competitions: prefs.competitions,
        followedTeams: prefs.followedTeams,
        allowLive: prefs.liveForMyMatches,
      }),
    prefs.autoRefresh ? 60000 : null,
    [prefs.competitions.join(','), prefs.liveForMyMatches],
  );

  const { rows, scenarios } = useMemo(() => {
    if (!active || !feed.data) return { rows: [] as LiveTableRow[], scenarios: [] };
    const built = buildLiveTable(feed.data.items, feed.data.matches, active);
    return { rows: built, scenarios: buildScenarios(built, active) };
  }, [active, feed.data]);

  const followed = new Set(prefs.followedTeams);
  const movingCount = rows.filter((r) => r.liveMatchId).length;

  return (
    <>
      <PageHead eyebrow="מרוץ העונה" title="טבלה" />

      {available.length > 1 && (
        <div className="chips">
          {available.map((c) => (
            <button
              key={c.id}
              className={`chip${c.id === active ? ' on' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              {c.short}
            </button>
          ))}
        </div>
      )}

      {scenarios.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>מה זז עכשיו</h2>
            <span className="meta">{movingCount} במשחק</span>
          </div>
          {scenarios.map((s, i) => (
            <div className={`scenario ${s.tone}`} key={i}>
              <span className="scenario-mark" />
              <span>{s.text}</span>
            </div>
          ))}
          <p className="section-note">
            הקרנה לפי התוצאות ברגע זה. שוויון נקודות נפתר אצלנו לפי הפרש
            שערים; ליגות שמכריעות קודם במפגשים ישירים עשויות לסדר אחרת.
          </p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>{available.find((c) => c.id === active)?.name ?? 'טבלה'}</h2>
          {movingCount > 0 && <span className="badge live"><i className="live-dot" />חי</span>}
        </div>

        {feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 260 }} />
        ) : rows.length === 0 ? (
          <p className="empty">
            אין טבלה זמינה לתחרות הזאת כרגע. בשלב הנוקאאוט אין טבלה, ובתחילת
            העונה היא עדיין ריקה.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="league-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>קבוצה</th>
                  <th className="num">מש׳</th>
                  <th className="num">הפ׳</th>
                  <th className="num">נק׳</th>
                  <th>כושר</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Row key={row.teamId} row={row} highlight={followed.has(row.team)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SourceNote feed={feed.data} />
    </>
  );
}
