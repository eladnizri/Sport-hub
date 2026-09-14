import { BROWSABLE } from '../data/competitions';
import type { Prefs } from '../lib/prefs';

interface Props {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onClose: () => void;
}

export function SettingsSheet({ prefs, onChange, onClose }: Props) {
  const toggleComp = (id: (typeof BROWSABLE)[number]['id']) => {
    const has = prefs.competitions.includes(id);
    // תמיד משאירים לפחות ליגה אחת דלוקה, אחרת כל המסכים ריקים
    if (has && prefs.competitions.length === 1) return;
    onChange({
      competitions: has ? prefs.competitions.filter((c) => c !== id) : [...prefs.competitions, id],
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="הגדרות">
        <div className="sheet-grip" />
        <h2>הגדרות</h2>
        <p className="sheet-sub">בחר אילו ליגות ומפעלים נכנסים לסקירה שלך</p>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>ליגות ומפעלים</div>
        <div className="chip-row" style={{ flexWrap: 'wrap', overflow: 'visible', marginBottom: 18 }}>
          {BROWSABLE.map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={prefs.competitions.includes(c.id)}
              onClick={() => toggleComp(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="section-note" style={{ padding: '6px 4px', textAlign: 'right' }}>
          מעגל הקבוצות והלגיונרים שלך נערך ממסך קבוצות — לחיצה על סמל ההגדרות שם.
        </p>

        <div className="card" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>מקור הנתונים</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            כל הנתונים מגיעים מקאש שנבנה בצד השרת כמה פעמים ביום. אין קריאה
            חוזרת לשום ספק מהדפדפן — זו אפליקציית סקירה, לא מעקב חי.
          </p>
        </div>

        <button className="chip" style={{ width: '100%', marginTop: 18, padding: 14, background: 'var(--green)', color: '#fff', justifyContent: 'center' }} onClick={onClose}>
          סגור
        </button>
      </div>
    </div>
  );
}
