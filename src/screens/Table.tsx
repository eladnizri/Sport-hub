import { useMemo, useState } from 'react';
import { getTableView } from '../data';
import { useFeed } from '../hooks/useFeed';
import { buildTable, buildScenarios } from '../lib/table';
import { displayName, TABLE_COMPETITIONS } from '../data/competitions';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId, TableRow } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';

/**
 * הטבלאות.
 *
 * שורת הטבלה מציגה את המיקום אחרי משחקי היום — עובדה אם המשחק כבר
 * הסתיים, תחזית אם עוד לא — לצד החץ שמראה מאיפה הקבוצה הגיעה. זו לא
 * טבלה שרצה תוך כדי משחק: היא מתעדכנת יחד עם הקאש, כמה פעמים ביום.
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

function Row({ row, highlight }: { row: TableRow; highlight: boolean }) {
  const today = row.todayMatchId != null;
  return (
    <tr className={`${today ? 'is-today-row' : ''}${highlight ? ' is-mine' : ''}`}>
      <td className="rank">
        <div className="rank-inner">
          <span>{row.rank}</span>
          {today && row.todayFinished && <MoveArrow delta={row.rankDelta} />}
        </div>
      </td>
      <td className="team">
        <div className="team-inner">
          <span className="crest sm" style={{ background: row.accent }}>{row.short}</span>
          <div className="team-text">
            <span className="team-name">{displayName(row.team)}</span>
            {row.todayLabel ? (
              <span className="team-sub today">{row.todayLabel}</span>
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
    () => getTableView(prefs.competitions),
    null,
    [prefs.competitions.join(',')],
  );

  const { rows, scenarios } = useMemo(() => {
    if (!active || !feed.data) return { rows: [] as TableRow[], scenarios: [] };
    const built = buildTable(feed.data.items, feed.data.matches, active);
    return { rows: built, scenarios: buildScenarios(built, active) };
  }, [active, feed.data]);

  const followed = new Set(prefs.followedTeams);
  const todayCount = rows.filter((r) => r.todayMatchId).length;

  return (
    <>
      <PageHead eyebrow="מרוץ העונה" title="טבלאות" />

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
            <h2>מה זז היום</h2>
            <span className="meta">{todayCount} משחקים</span>
          </div>
          {scenarios.map((s, i) => (
            <div className={`scenario ${s.tone}`} key={i}>
              <span className="scenario-mark" />
              <span>{s.text}</span>
            </div>
          ))}
          <p className="section-note">
            {scenarios.some((s) => !s.realized)
              ? 'משחק שעוד לא הסתיים מקבל תחזית לפי ניצחון או הפסד. שוויון נקודות נפתר אצלנו לפי הפרש שערים; ליגות שמכריעות קודם במפגשים ישירים עשויות לסדר אחרת.'
              : 'התנועה מחושבת מול המיקום שלפני משחקי היום.'}
          </p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>{available.find((c) => c.id === active)?.name ?? 'טבלה'}</h2>
          {todayCount > 0 && <span className="badge warm">{todayCount} משחקים היום</span>}
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
