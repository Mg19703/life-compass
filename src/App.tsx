import { useState } from 'react';
import type { TabId, PlanNavTarget } from './types';
import { todayISO } from './utils/dateUtils';
import { useAppState } from './hooks/useAppState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SetupTab } from './tabs/SetupTab';
import { TodayTab } from './tabs/TodayTab';
import { PlanTab } from './tabs/PlanTab';
import { ReviewTab } from './tabs/ReviewTab';
import { CoachTab } from './tabs/CoachTab';
import type { Message, PendingTool } from './tabs/CoachTab';
import type { AnthropicMessageParam } from './coach/callCoach';
import { HabitsTab } from './tabs/HabitsTab';
import './App.css';

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup',  label: 'Setup'  },
  { id: 'today',  label: 'Today'  },
  { id: 'plan',   label: 'Plan'   },
  { id: 'coach',  label: 'Coach'  },
  { id: 'review', label: 'Review' },
  { id: 'habits', label: 'Habits' },
];

export default function App() {
  const { state, updateState, getLatestState } = useAppState();

  const defaultTab: TabId = state.profile === null ? 'setup' : 'today';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const [planNavTarget, setPlanNavTarget] = useState<PlanNavTarget | null>(null);

  // Coach conversation — lives here so it survives tab switches within a session.
  // Resets on page reload (not persisted to localStorage).
  const [coachMessages,    setCoachMessages]    = useState<Message[]>([]);
  const [coachPendingTool, setCoachPendingTool] = useState<PendingTool | null>(null);
  const [coachHistory,     setCoachHistory]     = useState<AnthropicMessageParam[]>([]);

  // Carryover turmoil defer — session-only, not persisted. Cleared on page reload.
  const [turmoilDeferredUntil, setTurmoilDeferredUntil] = useState<string | null>(null);

  const navigateToPlan = (target: PlanNavTarget) => {
    setPlanNavTarget(target);
    setActiveTab('plan');
  };

  const navigateToHabits = () => setActiveTab('habits');
  const navigateToSetup  = () => setActiveTab('setup');

  const tabProps = { state, updateState, getLatestState };

  return (
    <div className="app-shell">
      <nav className="tab-bar" role="tablist">
        {TABS.map(({ id, label }) => {
          const today = todayISO();
          const todayMITs      = id === 'today' ? state.dailyMITs.filter(m => m.date === today) : [];
          const todayCompleted = todayMITs.filter(m => m.status === 'complete').length;
          const todayTotal     = Math.min(todayMITs.length, 10);
          const showBadge      = id === 'today';

          return (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              className={`tab-btn${activeTab === id ? ' tab-btn--active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setActiveTab(id)}
            >
              {label}
              {showBadge && (
                <span
                  aria-label={`${todayCompleted} of ${todayTotal} MITs done today`}
                  style={{
                    fontSize: 10, fontWeight: 700, lineHeight: 1.4,
                    color: 'var(--color-accent)',
                    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                    padding: '1px 5px', borderRadius: 8,
                  }}
                >
                  {todayCompleted}/{todayTotal}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="tab-content">
        {activeTab === 'setup'  && <ErrorBoundary tabLevel><SetupTab  {...tabProps} /></ErrorBoundary>}
        {activeTab === 'today'  && <ErrorBoundary tabLevel><TodayTab  {...tabProps} navigateToHabits={navigateToHabits} navigateToPlan={() => setActiveTab('plan')} turmoilDeferredUntil={turmoilDeferredUntil} setTurmoilDeferredUntil={setTurmoilDeferredUntil} /></ErrorBoundary>}
        {activeTab === 'plan'   && (
          <ErrorBoundary tabLevel>
            <PlanTab {...tabProps} navTarget={planNavTarget} onNavConsumed={() => setPlanNavTarget(null)} />
          </ErrorBoundary>
        )}
        {activeTab === 'coach'  && (
          <ErrorBoundary tabLevel>
            <CoachTab
              {...tabProps}
              navigateToSetup={navigateToSetup}
              messages={coachMessages}
              setMessages={setCoachMessages}
              pendingTool={coachPendingTool}
              setPendingTool={setCoachPendingTool}
              coachHistory={coachHistory}
              setCoachHistory={setCoachHistory}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'review' && (
          <ErrorBoundary tabLevel>
            <ReviewTab {...tabProps} navigateToPlan={navigateToPlan} navigateToSetup={navigateToSetup} />
          </ErrorBoundary>
        )}
        {activeTab === 'habits' && <ErrorBoundary tabLevel><HabitsTab {...tabProps} /></ErrorBoundary>}
      </main>
    </div>
  );
}
