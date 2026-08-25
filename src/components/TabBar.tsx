import { HomeIcon, LegionIcon, LiveIcon, RadarIcon } from './Icons';

export type TabId = 'home' | 'live' | 'legion' | 'radar';

const TABS: { id: TabId; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'home', label: 'בית', Icon: HomeIcon },
  { id: 'live', label: 'לייב', Icon: LiveIcon },
  { id: 'legion', label: 'לגיונרים', Icon: LegionIcon },
  { id: 'radar', label: 'רדאר', Icon: RadarIcon },
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
