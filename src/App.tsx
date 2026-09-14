import { useState } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { SettingsSheet } from './components/SettingsSheet';
import { usePrefs } from './hooks/usePrefs';
import { Overview } from './screens/Overview';
import { Teams } from './screens/Teams';
import { Table } from './screens/Table';

export default function App() {
  const { prefs, update } = usePrefs();
  const [tab, setTab] = useState<TabId>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <main className="scroll">
        {tab === 'overview' && (
          <Overview prefs={prefs} onOpenSettings={() => setSettingsOpen(true)} onNavigate={setTab} />
        )}
        {tab === 'teams' && <Teams prefs={prefs} onChange={update} />}
        {tab === 'table' && <Table prefs={prefs} />}
      </main>

      <TabBar active={tab} onChange={setTab} />

      {settingsOpen && (
        <SettingsSheet prefs={prefs} onChange={update} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
