import { OverviewIcon, ShieldIcon, TableIcon } from './Icons';

export type TabId = 'overview' | 'teams' | 'table';

const TABS: { id: TabId; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'overview', label: 'סקירה', Icon: OverviewIcon },
  { id: 'teams', label: 'קבוצות', Icon: ShieldIcon },
  { id: 'table', label: 'טבלאות', Icon: TableIcon },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="tab"
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
