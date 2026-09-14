import { useEffect, useMemo, useState } from 'react';
import { getLegionnaireList } from '../data';
import { BASE_LEGIONNAIRES } from '../data/legionnaires';
import { COMPETITIONS, displayName } from '../data/competitions';
import type { Prefs } from '../lib/prefs';
import type { CompetitionId, Legionnaire, Sport } from '../lib/types';

/**
 * ניהול רשימת הלגיונרים.
 *
 * הרשימה מגיעה משתי שכבות אוטומטיות (הבסיס בקוד + מי שה-Action זיהה
 * לפי לאום), ומעליהן העריכות שלך. כאן אפשר להסתיר מי שכבר לא מעניין
 * ולהוסיף מי שהזיהוי האוטומטי פספס — למשל שחקן שעבר מועדון היום.
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

export function LegionSheet({ prefs, onChange, onClose }: Props) {
  const [all, setAll] = useState<Legionnaire[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);

  // הרשימה המוצגת כאן כוללת גם את המוסתרים, אחרת אי אפשר להחזיר אותם
  useEffect(() => {
    getLegionnaireList({ custom: prefs.customLegionnaires, hiddenIds: [] }).then(setAll);
  }, [prefs.customLegionnaires]);

  const hidden = useMemo(() => new Set(prefs.hiddenLegionnaireIds), [prefs.hiddenLegionnaireIds]);

  const toggleHidden = (id: string) => {
    onChange({
      hiddenLegionnaireIds: hidden.has(id)
        ? prefs.hiddenLegionnaireIds.filter((x) => x !== id)
        : [...prefs.hiddenLegionnaireIds, id],
    });
  };

  const removeCustom = (id: string) => {
    onChange({ customLegionnaires: prefs.customLegionnaires.filter((p) => p.id !== id) });
  };

  const submit = () => {
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

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ניהול לגיונרים">
        <div className="sheet-grip" />
        <h2>לגיונרים במעקב</h2>
        <p className="sheet-sub">
          הרשימה מתעדכנת אוטומטית לפי לאום. כאן אפשר להסתיר, ולהוסיף מי שפוספס.
        </p>

        <div className="legion-list">
          {all.map((p) => {
            const off = hidden.has(p.id);
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
                  <button className="chip" onClick={() => toggleHidden(p.id)}>
                    {off ? 'החזר' : 'הסתר'}
                  </button>
                  {isCustom && p.custom && (
                    <button className="chip danger" onClick={() => removeCustom(p.id)}>מחק</button>
                  )}
                </div>
              </div>
            );
          })}
          {all.length === 0 && <p className="empty">אין עדיין רשימה — הוסף שחקן ראשון.</p>}
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
                onClick={submit}
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
