import { useState } from 'react';
import type { TabId, PlanNavTarget } from './types';
import { useAppState } from './hooks/useAppState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SetupTab } from './tabs/SetupTab';
import { TodayTab } from './tabs/TodayTab';
import { PlanTab } from './tabs/PlanTab';
import { ReviewTab } from './tabs/ReviewTab';
import { CoachTab } from './tabs/CoachTab';
import './App.css';

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup',  label: 'Setup'  },
  { id: 'today',  label: 'Today'  },
  { id: 'plan',   label: 'Plan'   },
  { id: 'coach',  label: 'Coach'  },
  { id: 'review', label: 'Review' },
];

export default function App() {
  const { state, updateState, getLatestState } = useAppState();

  const defaultTab: TabId = state.profile === null ? 'setup' : 'today';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  // Deep-link payload: set by ReviewTab to navigate Plan to a specific KR.
  // PlanTab reads it on mount, applies filter + expansion, then clears it.
  const [planNavTarget, setPlanNavTarget] = useState<PlanNavTarget | null>(null);

  const navigateToPlan = (target: PlanNavTarget) => {
    setPlanNavTarget(target);
    setActiveTab('plan');
  };

  const tabProps = { state, updateState, getLatestState };

  return (
    <div className="app-shell">
      <nav className="tab-bar" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-btn${activeTab === id ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === 'setup'  && <ErrorBoundary tabLevel><SetupTab  {...tabProps} /></ErrorBoundary>}
        {activeTab === 'today'  && <ErrorBoundary tabLevel><TodayTab  {...tabProps} /></ErrorBoundary>}
        {activeTab === 'plan'   && (
          <ErrorBoundary tabLevel>
            <PlanTab {...tabProps} navTarget={planNavTarget} onNavConsumed={() => setPlanNavTarget(null)} />
          </ErrorBoundary>
        )}
        {activeTab === 'coach'  && <ErrorBoundary tabLevel><CoachTab  {...tabProps} /></ErrorBoundary>}
        {activeTab === 'review' && (
          <ErrorBoundary tabLevel>
            <ReviewTab {...tabProps} navigateToPlan={navigateToPlan} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
