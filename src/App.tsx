import { useEffect, useState } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { SettingsSheet } from './components/SettingsSheet';
import { usePrefs } from './hooks/usePrefs';
import { Home } from './screens/Home';
import { Live } from './screens/Live';
import { Legionnaires } from './screens/Legionnaires';
import { Radar } from './screens/Radar';
import { Matchday } from './screens/Matchday';
import { getMatches } from './data';

export default function App() {
  const { prefs, update } = usePrefs();
  const [tab, setTab] = useState<TabId>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [matchdayOpen, setMatchdayOpen] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  // "יום משחק אוטומטי": נכנסים לתצוגה המרוכזת פעם אחת, כשבאמת עמוס.
  useEffect(() => {
    if (!prefs.autoMatchday || autoPrompted || matchdayOpen) return;
    let cancelled = false;
    getMatches(prefs.competitions).then((feed) => {
      if (cancelled) return;
      const live = feed.items.filter((m) => m.status === 'live' || m.status === 'halftime');
      if (live.length >= 3) {
        setMatchdayOpen(true);
        setAutoPrompted(true);
      }
    });
    return () => { cancelled = true; };
  }, [prefs.autoMatchday, prefs.competitions, autoPrompted, matchdayOpen]);

  return (
    <div className="app">
      <main className="scroll">
        {tab === 'home' && (
          <Home
            prefs={prefs}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenMatchday={() => setMatchdayOpen(true)}
            onNavigate={setTab}
          />
        )}
        {tab === 'live' && <Live prefs={prefs} onOpenMatchday={() => setMatchdayOpen(true)} />}
        {tab === 'legion' && <Legionnaires prefs={prefs} />}
        {tab === 'radar' && <Radar prefs={prefs} />}
      </main>

      <TabBar active={tab} onChange={setTab} />

      {matchdayOpen && <Matchday prefs={prefs} onClose={() => setMatchdayOpen(false)} />}
      {settingsOpen && (
        <SettingsSheet prefs={prefs} onChange={update} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
