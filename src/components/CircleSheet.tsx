import { useEffect, useMemo, useState } from 'react';
import { getLegionnaireList } from '../data';
import { BASE_LEGIONNAIRES } from '../data/legionnaires';
import { COMPETITIONS, ISRAELI_CLUBS, displayName, isIsraeliClub } from '../data/competitions';
import { circleReason, reasonLabel } from '../lib/circle';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId, Legionnaire, Sport } from '../lib/types';

/**
 * ניהול מעגל המעקב: הקבוצות שמסך "קבוצות" מציג, והלגיונרים שמופיעים
 * בתוכן. שתי הרשימות מתעדכנות אוטומטית (קבוצות ישראליות, לגיונרים
 * שזוהו בצד השרת) ומעליהן העריכות שלך — הוספה של מה שפוספס, והסתרה
 * של מה שכבר לא מעניין.
 */

interface Props {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onClose: () => void;
}

const EMPTY_DRAFT = {
  name: '',
  club: '',
  position: '',
  competition: 'champions-league' as CompetitionId,
  sport: 'football' as Sport,
};

function slug(name: string): string {
  const base = name.trim().replace(/\s+/g, '-').toLowerCase();
  return `custom-${base || Date.now().toString(36)}`;
}

export function CircleSheet({ prefs, onChange, onClose }: Props) {
  const [legionnaires, setLegionnaires] = useState<Legionnaire[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [teamDraft, setTeamDraft] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  // הרשימה המוצגת כוללת גם את המוסתרים, אחרת אי אפשר להחזיר אותם
  useEffect(() => {
    getLegionnaireList({ custom: prefs.customLegionnaires, hiddenIds: [] }).then(setLegionnaires);
  }, [prefs.customLegionnaires]);

  const hiddenLegion = useMemo(() => new Set(prefs.hiddenLegionnaireIds), [prefs.hiddenLegionnaireIds]);
  const hiddenTeamsSet = useMemo(() => new Set(prefs.hiddenTeams.map((t) => t.toLowerCase())), [prefs.hiddenTeams]);

  const toggleHiddenLegion = (id: string) => {
    onChange({
      hiddenLegionnaireIds: hiddenLegion.has(id)
        ? prefs.hiddenLegionnaireIds.filter((x) => x !== id)
        : [...prefs.hiddenLegionnaireIds, id],
    });
  };

  const removeCustomLegion = (id: string) => {
    onChange({ customLegionnaires: prefs.customLegionnaires.filter((p) => p.id !== id) });
  };

  const submitLegion = () => {
    if (!draft.name.trim() || !draft.club.trim()) return;
    const player: Legionnaire = {
      id: slug(draft.name),
      name: draft.name.trim(),
      club: draft.club.trim(),
      competition: draft.competition,
      sport: draft.sport,
      position: draft.position.trim() || '—',
      accent: `hsl(${(draft.name.length * 47) % 360} 55% 42%)`,
      custom: true,
    };
    onChange({ customLegionnaires: [...prefs.customLegionnaires, player] });
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const baseIds = new Set(BASE_LEGIONNAIRES.map((p) => p.id));

  /* --- מעגל הקבוצות --- */

  const teamRoster = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; auto: boolean }[] = [];
    const add = (name: string, auto: boolean) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name, auto });
    };
    for (const c of ISRAELI_CLUBS) add(c.provider, true);
    for (const p of legionnaires) if (p.club) add(p.club, true);
    for (const t of prefs.followedTeams) add(t, false);
    return out;
  }, [legionnaires, prefs.followedTeams]);

  const toggleHiddenTeam = (name: string) => {
    const key = name.toLowerCase();
    onChange({
      hiddenTeams: hiddenTeamsSet.has(key)
        ? prefs.hiddenTeams.filter((t) => t.toLowerCase() !== key)
        : [...prefs.hiddenTeams, name],
    });
  };

  const removeFollowed = (name: string) => {
    onChange({ followedTeams: prefs.followedTeams.filter((t) => t.toLowerCase() !== name.toLowerCase()) });
  };

  const submitTeam = () => {
    const name = teamDraft.trim();
    if (!name) return;
    onChange({ followedTeams: [...prefs.followedTeams, name] });
    setTeamDraft('');
    setAddingTeam(false);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="מעגל המעקב">
        <div className="sheet-grip" />
        <h2>מעגל המעקב</h2>
        <p className="sheet-sub">קבוצות ישראליות ומועדוני לגיונרים נכנסים אוטומטית. הוסף מה שפוספס, והסתר מה שלא מעניין.</p>

        <div style={{ fontWeight: 700, fontSize: 15, margin: '4px 0 8px' }}>קבוצות</div>
        <div className="legion-list">
          {teamRoster.map(({ name, auto }) => {
            const off = hiddenTeamsSet.has(name.toLowerCase());
            const reason = circleReason(name, legionnaires, prefs.followedTeams, []);
            return (
              <div className={`legion-row${off ? ' off' : ''}`} key={name}>
                <span className="avatar sm" style={{ background: isIsraeliClub(name) ? '#2f7a5a' : '#4b3f9e' }}>
                  {displayName(name).slice(0, 2)}
                </span>
                <div className="r-main">
                  <div className="r-title">{displayName(name)}</div>
                  <div className="r-sub">
                    {reason ? reasonLabel(reason) : 'הוסר'}
                    {!auto && <span className="badge" style={{ marginRight: 6 }}>ידני</span>}
                  </div>
                </div>
                <div className="legion-actions">
                  {auto ? (
                    <button className="chip" onClick={() => toggleHiddenTeam(name)}>{off ? 'החזר' : 'הסתר'}</button>
                  ) : (
                    <button className="chip danger" onClick={() => removeFollowed(name)}>מחק</button>
                  )}
                </div>
              </div>
            );
          })}
          {teamRoster.length === 0 && <p className="empty">אין עדיין קבוצות במעגל.</p>}
        </div>

        {addingTeam ? (
          <div className="add-form">
            <label>
              <span>שם הקבוצה — בשם שהספק מחזיר</span>
              <input
                value={teamDraft}
                onChange={(e) => setTeamDraft(e.target.value)}
                placeholder="Liverpool"
              />
            </label>
            <div className="form-actions">
              <button className="chip" onClick={() => { setAddingTeam(false); setTeamDraft(''); }}>ביטול</button>
              <button className="chip primary" onClick={submitTeam} disabled={!teamDraft.trim()}>הוסף</button>
            </div>
          </div>
        ) : (
          <button className="chip wide" onClick={() => setAddingTeam(true)}>+ הוסף קבוצה למעגל</button>
        )}

        <div style={{ fontWeight: 700, fontSize: 15, margin: '22px 0 8px' }}>לגיונרים</div>
        <div className="legion-list">
          {legionnaires.map((p) => {
            const off = hiddenLegion.has(p.id);
            const isCustom = p.custom || !baseIds.has(p.id);
            return (
              <div className={`legion-row${off ? ' off' : ''}`} key={p.id}>
                <span className="avatar sm" style={{ background: p.accent }}>
                  {p.name.split(' ')[0].slice(0, 2)}
                </span>
                <div className="r-main">
                  <div className="r-title">{p.name}</div>
                  <div className="r-sub">
                    {displayName(p.club)} · {p.position}
                    {p.custom && <span className="badge" style={{ marginRight: 6 }}>ידני</span>}
                  </div>
                </div>
                <div className="legion-actions">
                  <button className="chip" onClick={() => toggleHiddenLegion(p.id)}>
                    {off ? 'החזר' : 'הסתר'}
                  </button>
                  {isCustom && p.custom && (
                    <button className="chip danger" onClick={() => removeCustomLegion(p.id)}>מחק</button>
                  )}
                </div>
              </div>
            );
          })}
          {legionnaires.length === 0 && <p className="empty">אין עדיין רשימה — הוסף שחקן ראשון.</p>}
        </div>

        {adding ? (
          <div className="add-form">
            <label>
              <span>שם השחקן</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="למשל: אוסקר גלוך"
              />
            </label>
            <label>
              <span>מועדון — בשם שהספק מחזיר</span>
              <input
                value={draft.club}
                onChange={(e) => setDraft({ ...draft, club: e.target.value })}
                placeholder="RB Salzburg"
              />
            </label>
            <label>
              <span>עמדה</span>
              <input
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                placeholder="קשר התקפי"
              />
            </label>
            <label>
              <span>תחרות במעקב</span>
              <select
                value={draft.competition}
                onChange={(e) => {
                  const competition = e.target.value as CompetitionId;
                  const sport = COMPETITIONS.find((c) => c.id === competition)?.sport ?? 'football';
                  setDraft({ ...draft, competition, sport });
                }}
              >
                {COMPETITIONS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <p className="section-note">
              שם המועדון מושווה מול מה שספק הנתונים מחזיר, בהשוואה סלחנית —
              "Salzburg" יתפוס גם "RB Salzburg". אם השחקן לא מזוהה, נסה את השם
              המלא באנגלית.
            </p>
            <div className="form-actions">
              <button className="chip" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}>
                ביטול
              </button>
              <button
                className="chip primary"
                onClick={submitLegion}
                disabled={!draft.name.trim() || !draft.club.trim()}
              >
                הוסף
              </button>
            </div>
          </div>
        ) : (
          <button className="chip wide" onClick={() => setAdding(true)}>+ הוסף לגיונר</button>
        )}

        <button className="chip wide primary" style={{ marginTop: 12 }} onClick={onClose}>
          סגור
        </button>
      </div>
    </div>
  );
}
