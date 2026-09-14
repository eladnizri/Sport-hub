import { useMemo, useState } from 'react';
import { getTableView } from '../data';
import { useFeed } from '../hooks/useFeed';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId } from '../lib/types';
import { BROWSABLE } from '../data/competitions';
import { buildLiveTable } from '../lib/liveTable';
import { MatchCard } from '../components/MatchCard';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GridIcon } from '../components/Icons';

type Filter = 'all' | 'live' | 'today' | 'mine' | CompetitionId;

interface Props {
  prefs: Prefs;
  onOpenMatchday: () => void;
}

export function Live({ prefs, onOpenMatchday }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const feed = useFeed(
    () =>
      getTableView({
        competitions: prefs.competitions,
        followedTeams: prefs.followedTeams,
        allowLive: prefs.liveForMyMatches,
      }),
    prefs.autoRefresh ? 30000 : null,
    [prefs.competitions.join(','), prefs.liveForMyMatches],
  );

  const matches = feed.data?.visible ?? [];
  const allMatches = feed.data?.matches ?? [];
  const standings = feed.data?.items ?? [];
  const liveCount = matches.filter((m) => m.status === 'live' || m.status === 'halftime').length;

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'live') return matches.filter((m) => m.status === 'live' || m.status === 'halftime');
    if (filter === 'today') return matches.filter((m) => m.status === 'scheduled');
    if (filter === 'mine') return matches.filter((m) => m.israeliInterest);
    return matches.filter((m) => m.competition === filter);
  }, [matches, filter]);

  // טבלה חיה לכל תחרות, כדי ששורת "המשמעות" בסיכום תדבר על המיקום
  // האמיתי ולא על ניחוש. מחושבת פעם אחת לכל רינדור ולא לכל כרטיס.
  const tables = useMemo(() => {
    const out = new Map<CompetitionId, ReturnType<typeof buildLiveTable>>();
    for (const c of prefs.competitions) {
      out.set(c, buildLiveTable(standings, allMatches, c));
    }
    return out;
  }, [standings, allMatches, prefs.competitions]);

  const toggleCard = (id: string) => {
    if (prefs.spoilerFree && !revealed.has(id)) {
      setRevealed((prev) => new Set(prev).add(id));
      return;
    }
    setOpen((prev) => (prev === id ? null : id));
  };

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'הכל' },
    { id: 'live', label: `חי${liveCount ? ` (${liveCount})` : ''}` },
    { id: 'today', label: 'בהמשך היום' },
    { id: 'mine', label: 'שלי' },
    ...BROWSABLE.filter((c) => prefs.competitions.includes(c.id)).map((c) => ({ id: c.id as Filter, label: c.short })),
  ];

  return (
    <>
      <PageHead
        eyebrow="מרכז משחקים"
        title="לייב"
        action={
          <button className="icon-btn" onClick={onOpenMatchday} aria-label="מצב יום משחק">
            <GridIcon />
          </button>
        }
      />

      <div className="chip-row">
        {chips.map((c) => (
          <button key={c.id} className="chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{filter === 'live' ? 'רץ עכשיו' : 'לוח משחקים'}</h2>
          <span className="meta">{filtered.length} משחקים</span>
        </div>

        {feed.loading && !feed.data ? (
          <>
            <div className="skeleton" style={{ height: 110, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 110 }} />
          </>
        ) : filtered.length === 0 ? (
          <p className="empty">אין משחקים שתואמים לסינון הזה</p>
        ) : (
          filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              spoilerFree={prefs.spoilerFree}
              revealed={revealed.has(m.id)}
              onToggle={toggleCard}
              showStats={open === m.id}
              table={tables.get(m.competition)}
            />
          ))
        )}
      </section>

      <SourceNote feed={feed.data} />
    </>
  );
}
