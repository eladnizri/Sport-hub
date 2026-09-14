import { useMemo, useState } from 'react';
import { getLegionnaires } from '../data';
import { useFeed } from '../hooks/useFeed';
import { clockTime, countdown } from '../lib/format';
import { competitionName, displayName } from '../data/competitions';
import { legionPrefs, type Prefs } from '../lib/prefs';
import type { LegionnaireAppearance, LegionnaireDossier } from '../lib/types';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GearIcon } from '../components/Icons';
import { LegionSheet } from '../components/LegionSheet';

/**
 * מסך הלגיונרים.
 *
 * לא "כמה דקות שיחק אתמול" אלא "הוא בדרך למעלה או למטה": מגמת דקות
 * בחמישה משחקים, מעמד בהרכב, והמשחק הבא. השורה נפתחת לתיק מלא.
 */

const TREND_LABEL = {
  rising: { text: 'במגמת עלייה', cls: 'up' },
  falling: { text: 'מאבד דקות', cls: 'down' },
  steady: { text: 'יציב', cls: '' },
  unknown: { text: 'אין מספיק נתונים', cls: '' },
} as const;

const STATUS_LABEL = {
  playing: 'על המגרש',
  played: 'שיחק',
  bench: 'ספסל',
  upcoming: 'לפני משחק',
  out: 'בחוץ',
  unknown: '—',
} as const;

/**
 * גרף דקות זעיר. הציר האנכי נמדד מול משחק מלא, כך שעמודה מלאה היא 90
 * דקות (או 34 בכדורסל) — ולא מול המקסימום של השחקן עצמו, שהיה מסתיר
 * בדיוק את מה שאנחנו רוצים לראות.
 */
function MinutesBars({ rows, max }: { rows: LegionnaireAppearance[]; max: number }) {
  if (!rows.length) return null;
  // rows מגיע חדש-ראשון. היפוך מציב את הישן ראשון במסמך, ו-direction: rtl
  // על .spark מציב את הראשון מימין — כך שהזמן זורם ימין לשמאל כמו הטקסט.
  const ordered = [...rows].reverse();
  return (
    <div
      className="spark"
      role="img"
      aria-label={`דקות ב-${rows.length} המשחקים האחרונים, מהישן מימין לחדש משמאל`}
    >
      {ordered.map((a) => (
        <i
          key={a.fixtureId}
          className={`spark-bar${a.started ? ' start' : ''}${a.minutes === 0 ? ' zero' : ''}`}
          style={{ height: `${Math.max(6, Math.round((a.minutes / max) * 100))}%` }}
          title={`${a.minutes} דק׳ מול ${displayName(a.opponent)}`}
        />
      ))}
    </div>
  );
}

function Contribution({ row, sport }: { row: LegionnaireAppearance; sport: 'football' | 'basketball' }) {
  if (sport === 'basketball') {
    return <>{row.points ?? 0} נק׳ · {row.rebounds ?? 0} ריב׳</>;
  }
  const bits: string[] = [];
  if (row.goals) bits.push(`${row.goals} שער${row.goals > 1 ? 'ים' : ''}`);
  if (row.assists) bits.push(`${row.assists} בישול${row.assists > 1 ? 'ים' : ''}`);
  return <>{bits.length ? bits.join(' · ') : `${row.minutes} דק׳`}</>;
}

function Dossier({ dossier, open, onToggle }: {
  dossier: LegionnaireDossier;
  open: boolean;
  onToggle: () => void;
}) {
  const { player, recent, trend, next } = dossier;
  const maxMinutes = player.sport === 'basketball' ? 34 : 90;
  const tone = TREND_LABEL[trend];

  return (
    <div className={`dossier${open ? ' open' : ''}`}>
      <button className="dossier-head" onClick={onToggle} aria-expanded={open}>
        <span className="avatar" style={{ background: player.accent }}>
          {player.name.split(' ')[0].slice(0, 2)}
        </span>

        <div className="r-main">
          <div className="r-title">
            {player.name}
            {dossier.status === 'playing' && <i className="live-dot" />}
          </div>
          <div className="r-sub">
            {displayName(player.club)} · {dossier.standing}
          </div>
          <div className="r-status">{STATUS_LABEL[dossier.status]}</div>
        </div>

        <div className="dossier-end">
          <MinutesBars rows={recent} max={maxMinutes} />
          <span className={`trend ${tone.cls}`}>{tone.text}</span>
        </div>
      </button>

      {open && (
        <div className="dossier-body">
          <div className="grid-3">
            <div className="tile compact">
              <div className="label">ממוצע דקות</div>
              <div className="value">{dossier.avgMinutes}</div>
              <div className="delta">ב-{recent.length} אחרונים</div>
            </div>
            <div className="tile compact">
              <div className="label">הרכבים</div>
              <div className="value">{dossier.starts}</div>
              <div className="delta">מתוך {recent.length}</div>
            </div>
            <div className="tile compact">
              <div className="label">{player.sport === 'basketball' ? 'נקודות' : 'תרומות'}</div>
              <div className="value">
                {player.sport === 'basketball'
                  ? recent.reduce((s, r) => s + (r.points ?? 0), 0)
                  : dossier.goals + dossier.assists}
              </div>
              <div className="delta">ב-{recent.length} אחרונים</div>
            </div>
          </div>

          <ul className="appearances">
            {recent.map((a) => (
              <li key={a.fixtureId}>
                <span className="app-date">
                  {new Date(a.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                </span>
                <span className="app-opp">
                  {a.away ? 'בחוץ מול ' : 'בבית מול '}{displayName(a.opponent)}
                </span>
                <span className={`app-min${a.started ? ' start' : ''}`}>
                  {a.minutes === 0 ? 'לא שיחק' : `${a.minutes}׳`}
                </span>
                <span className="app-contrib">
                  <Contribution row={a} sport={player.sport} />
                </span>
              </li>
            ))}
            {recent.length === 0 && <li className="empty">אין היסטוריית משחקים בקאש עדיין</li>}
          </ul>

          {next ? (
            <div className="next-up">
              <span className="label">הבא בתור</span>
              <span>
                מול {next.opponent} · {competitionName(next.competition)} ·{' '}
                {clockTime(next.kickoff)} ({countdown(next.kickoff)})
              </span>
            </div>
          ) : (
            <p className="section-note">אין משחק קרוב ידוע למועדון שלו בלוח שבקאש.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Legionnaires({ prefs, onChange }: {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [manage, setManage] = useState(false);

  const feed = useFeed(
    () => getLegionnaires({ prefs: legionPrefs(prefs), allowLive: prefs.liveForMyMatches }),
    prefs.autoRefresh ? 60000 : null,
    [prefs.customLegionnaires.length, prefs.hiddenLegionnaireIds.join(','), prefs.liveForMyMatches],
  );

  const items = feed.data?.items ?? [];

  const summary = useMemo(() => {
    const playing = items.filter((d) => d.status === 'playing').length;
    const rising = items.filter((d) => d.trend === 'rising').length;
    const falling = items.filter((d) => d.trend === 'falling').length;
    return { playing, rising, falling };
  }, [items]);

  return (
    <>
      <PageHead
        eyebrow="הישראלים בחו״ל"
        title="לגיונרים"
        action={
          <button className="icon-btn" onClick={() => setManage(true)} aria-label="ניהול הרשימה">
            <GearIcon />
          </button>
        }
      />

      <section className="card">
        <div className="grid-3">
          <div className="tile compact">
            <div className="label">על המגרש</div>
            <div className="value">{summary.playing}</div>
            <div className={`delta ${summary.playing ? 'pos' : ''}`}>עכשיו</div>
          </div>
          <div className="tile compact">
            <div className="label">בעלייה</div>
            <div className="value">{summary.rising}</div>
            <div className="delta pos">מקבלים דקות</div>
          </div>
          <div className="tile compact">
            <div className="label">בירידה</div>
            <div className="value">{summary.falling}</div>
            <div className="delta">מאבדים דקות</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>התיקים</h2>
          <span className="meta">{items.length} במעקב</span>
        </div>

        {feed.loading && !feed.data ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : items.length === 0 ? (
          <p className="empty">הרשימה ריקה. הוסף שחקנים מכפתור ההגדרות למעלה.</p>
        ) : (
          items.map((d) => (
            <Dossier
              key={d.player.id}
              dossier={d}
              open={open === d.player.id}
              onToggle={() => setOpen(open === d.player.id ? null : d.player.id)}
            />
          ))
        )}
      </section>

      <SourceNote feed={feed.data} />

      {manage && (
        <LegionSheet prefs={prefs} onChange={onChange} onClose={() => setManage(false)} />
      )}
    </>
  );
}
