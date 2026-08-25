import { COMPETITIONS } from '../data/competitions';
import { providersConfigured } from '../data';
import type { Prefs } from '../lib/prefs';

interface Props {
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onClose: () => void;
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="toggle-row">
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export function SettingsSheet({ prefs, onChange, onClose }: Props) {
  const providers = providersConfigured();

  const toggleComp = (id: (typeof COMPETITIONS)[number]['id']) => {
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
        <p className="sheet-sub">בחר מה נכנס לחמ״ל שלך</p>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>ליגות ומפעלים</div>
        <div className="chip-row" style={{ flexWrap: 'wrap', overflow: 'visible', marginBottom: 18 }}>
          {COMPETITIONS.map((c) => (
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

        <Switch
          label="רענון אוטומטי"
          hint="מושך עדכון כל 30 שניות כשיש משחק חי"
          checked={prefs.autoRefresh}
          onChange={(v) => onChange({ autoRefresh: v })}
        />
        <Switch
          label="מצב ללא ספוילרים"
          hint="מסתיר תוצאות עד שנוגעים בכרטיס המשחק"
          checked={prefs.spoilerFree}
          onChange={(v) => onChange({ spoilerFree: v })}
        />
        <Switch
          label="יום משחק אוטומטי"
          hint="נכנס לתצוגה המרוכזת כשרצים 3 משחקים ומעלה במקביל"
          checked={prefs.autoMatchday}
          onChange={(v) => onChange({ autoMatchday: v })}
        />

        <div className="card" style={{ marginTop: 18, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>מקורות נתונים</div>
          <div className="toggle-row" style={{ padding: '6px 0' }}>
            <span style={{ fontSize: 14 }}>כדורגל · API-Football</span>
            <span className={`badge ${providers.football ? 'green' : ''}`}>{providers.football ? 'מחובר' : 'לא מוגדר'}</span>
          </div>
          <div className="toggle-row" style={{ padding: '6px 0' }}>
            <span style={{ fontSize: 14 }}>NBA · balldontlie</span>
            <span className={`badge ${providers.nba ? 'green' : ''}`}>{providers.nba ? 'מחובר' : 'לא מוגדר'}</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.6 }}>
            הוסף <code>VITE_API_FOOTBALL_KEY</code> ו-<code>VITE_BALLDONTLIE_KEY</code> לקובץ
            <code> .env</code> והפעל מחדש. עד אז האפליקציה רצה על נתוני הדגמה חיים.
          </p>
        </div>

        <button className="chip" style={{ width: '100%', marginTop: 18, padding: 14, background: 'var(--green)', color: '#fff', justifyContent: 'center' }} onClick={onClose}>
          סגור
        </button>
      </div>
    </div>
  );
}
