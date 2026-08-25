import { useMemo, useState } from 'react';
import { getMatches } from '../data';
import { useFeed } from '../hooks/useFeed';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId } from '../lib/types';
import { COMPETITIONS } from '../data/competitions';
import { MatchCard } from '../components/MatchCard';
import { PageHead } from '../components/PageHead';
import { SourceNote } from '../components/SourceNote';
import { GridIcon } from '../components/Icons';

type Filter = 'all' | 'live' | 'today' | CompetitionId;

interface Props {
  prefs: Prefs;
  onOpenMatchday: () => void;
}

export function Live({ prefs, onOpenMatchday }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const feed = useFeed(
    () => getMatches(prefs.competitions),
    prefs.autoRefresh ? 30000 : null,
    [prefs.competitions.join(',')],
  );

  const matches = feed.data?.items ?? [];
  const liveCount = matches.filter((m) => m.status === 'live' || m.status === 'halftime').length;

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    if (filter === 'live') return matches.filter((m) => m.status === 'live' || m.status === 'halftime');
    if (filter === 'today') return matches.filter((m) => m.status === 'scheduled');
    return matches.filter((m) => m.competition === filter);
  }, [matches, filter]);

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
    ...COMPETITIONS.filter((c) => prefs.competitions.includes(c.id)).map((c) => ({ id: c.id as Filter, label: c.short })),
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
            />
          ))
        )}
      </section>

      <SourceNote feed={feed.data} />
    </>
  );
}
