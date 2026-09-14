import { useState } from 'react';
import { getTeamStatuses } from '../data';
import { useFeed } from '../hooks/useFeed';
import { displayName, competitionName } from '../data/competitions';
import { matchWhen, relativeTime } from '../lib/format';
import { legionPrefs, type Prefs } from '../lib/prefs';
import type { TeamStatus } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GearIcon } from '../components/Icons';
import { CircleSheet } from '../components/CircleSheet';

/**
 * מסך הקבוצות — מהות האפליקציה. לא לייב: לכל קבוצה במעגל שלך שלוש
 * עובדות — איפה בטבלה, מה קרה במשחק האחרון, מתי הבא. לגיונר שמשחק
 * בקבוצה מקבל שורה נוספת בתוך אותו כרטיס, לא מסך נפרד.
 */

function outcomeLabel(outcome: 'win' | 'draw' | 'loss'): { text: string; cls: string } {
  if (outcome === 'win') return { text: 'ניצחון', cls: 'green' };
  if (outcome === 'loss') return { text: 'הפסד', cls: 'red' };
  return { text: 'תיקו', cls: '' };
}

const TREND_LABEL = {
  rising: { text: 'במגמת עלייה', cls: 'up' },
  falling: { text: 'מאבד דקות', cls: 'down' },
  steady: { text: 'יציב', cls: '' },
  unknown: { text: '', cls: '' },
} as const;

function TeamCard({ status, open, onToggle }: { status: TeamStatus; open: boolean; onToggle: () => void }) {
  const { table, lastResult, nextMatch, scenario, legionnaire } = status;

  return (
    <div className="dossier">
      <button className="dossier-head" onClick={onToggle} aria-expanded={open}>
        <span className="avatar sm" style={{ background: status.accent }}>
          {displayName(status.team).slice(0, 2)}
        </span>

        <div className="r-main">
          <div className="r-title">{displayName(status.team)}</div>
          <div className="r-sub">
            {table
              ? `מקום ${table.rank}${table.gapText ? ` · ${table.gapText.replace(/^מקום \d+ · /, '')}` : ''}`
              : competitionName(status.competition)}
          </div>
        </div>

        <div className="dossier-end">
          {table?.form && (
            <span className="form-dots" aria-label={`כושר: ${table.form}`}>
              {table.form.slice(-5).split('').reverse().map((r, i) => (
                <i key={i} className={`form-dot ${r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'}`} />
              ))}
            </span>
          )}
          {legionnaire && <span className="badge">{legionnaire.player.name.split(' ')[0]}</span>}
        </div>
      </button>

      {open && (
        <div className="dossier-body">
          {scenario && (
            <div className={`scenario ${scenario.tone}`}>
              <span className="scenario-mark" />
              <span>{scenario.text}</span>
            </div>
          )}

          <div className="row" style={{ padding: '10px 0' }}>
            <div className="r-main">
              <div className="r-title" style={{ fontSize: 14 }}>
                {lastResult ? `${lastResult.scoreFor}-${lastResult.scoreAgainst} מול ${lastResult.opponent}` : 'אין תוצאה אחרונה'}
              </div>
              {lastResult && <div className="r-sub">{relativeTime(lastResult.date)}</div>}
            </div>
            {lastResult && (
              <span className={`badge ${outcomeLabel(lastResult.outcome).cls}`}>
                {outcomeLabel(lastResult.outcome).text}
              </span>
            )}
          </div>

          {lastResult?.narrative && (
            <div className="narrative" style={{ marginTop: 0 }}>
              <div className="nar-row">
                <span className="nar-label">מה הכריע</span>
                <span>{lastResult.narrative.verdict}</span>
              </div>
              <div className="nar-row">
                <span className="nar-label">מי בלט</span>
                <span>{lastResult.narrative.standout}</span>
              </div>
              <div className="nar-row">
                <span className="nar-label">המשמעות</span>
                <span>{lastResult.narrative.meaning}</span>
              </div>
              {lastResult.narrative.by === 'template' && (
                <p className="nar-by">נבנה מהנתונים · לא נוסח על ידי מודל שפה</p>
              )}
            </div>
          )}

          <div className="row" style={{ padding: '10px 0' }}>
            <div className="r-main">
              <div className="r-title" style={{ fontSize: 14 }}>
                {nextMatch ? `הבא: מול ${nextMatch.opponent}` : 'אין משחק קרוב בלוח'}
              </div>
              {nextMatch && <div className="r-sub">{matchWhen(nextMatch.kickoff)}</div>}
            </div>
          </div>

          {legionnaire && (
            <div className="next-up" style={{ background: 'var(--tile)' }}>
              <span className="label" style={{ color: 'var(--ink-soft)' }}>
                {legionnaire.player.name} · {legionnaire.player.position}
              </span>
              <span>
                {legionnaire.standing}
                {TREND_LABEL[legionnaire.trend].text ? ` · ${TREND_LABEL[legionnaire.trend].text}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Teams({ prefs, onChange }: { prefs: Prefs; onChange: (patch: Partial<Prefs>) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [manage, setManage] = useState(false);

  const feed = useFeed(
    () => getTeamStatuses({ legionnaires: legionPrefs(prefs), followedTeams: prefs.followedTeams, hiddenTeams: prefs.hiddenTeams }),
    null,
    [prefs.followedTeams.join(','), prefs.hiddenTeams.join(','), prefs.hiddenLegionnaireIds.join(','), prefs.customLegionnaires.length],
  );

  const items = feed.data?.items ?? [];

  return (
    <>
      <PageHead
        eyebrow="מה קורה אצל כל אחת"
        title="קבוצות"
        action={
          <button className="icon-btn" onClick={() => setManage(true)} aria-label="ניהול המעגל">
            <GearIcon />
          </button>
        }
      />

      <section className="card">
        {feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : items.length === 0 ? (
          <p className="empty">המעגל ריק. הוסף קבוצות מכפתור ההגדרות למעלה.</p>
        ) : (
          items.map((status) => (
            <TeamCard
              key={`${status.team}-${status.competition}`}
              status={status}
              open={open === status.team}
              onToggle={() => setOpen(open === status.team ? null : status.team)}
            />
          ))
        )}
      </section>

      <SourceNote feed={feed.data} />

      {manage && <CircleSheet prefs={prefs} onChange={onChange} onClose={() => setManage(false)} />}
    </>
  );
}
