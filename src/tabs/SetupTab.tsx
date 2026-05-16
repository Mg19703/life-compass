import { useEffect, useState } from 'react';
import type { TabProps, DimensionId } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';

// ─── STORY-004: Profile Form ─────────────────────────────────────────────────

export function ProfileForm({ state, updateState }: TabProps) {
  const [name, setName] = useState(state.profile?.name ?? '');
  const [role, setRole] = useState(state.profile?.role ?? '');
  const [bio, setBio]   = useState(state.profile?.bio  ?? '');
  const [errors, setErrors] = useState<{ name?: string; role?: string }>({});
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    setName(state.profile?.name ?? '');
    setRole(state.profile?.role ?? '');
    setBio(state.profile?.bio  ?? '');
  }, [state.profile]);

  const handleSave = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!role.trim()) errs.role = 'Role is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    updateState({ profile: { name: name.trim(), role: role.trim(), bio: bio.trim() } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="section-content">
      <div className="form-field">
        <label htmlFor="profile-name" className="form-label">
          Name <span className="required">*</span>
        </label>
        <input
          id="profile-name"
          className="input-base"
          value={name}
          maxLength={100}
          onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="profile-role" className="form-label">
          Current Role <span className="required">*</span>
        </label>
        <input
          id="profile-role"
          className="input-base"
          value={role}
          maxLength={100}
          onChange={e => { setRole(e.target.value); setErrors(p => ({ ...p, role: undefined })); }}
        />
        {errors.role && <span className="field-error">{errors.role}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="profile-bio" className="form-label">Bio</label>
        <textarea
          id="profile-bio"
          className="input-base"
          value={bio}
          maxLength={500}
          rows={4}
          onChange={e => setBio(e.target.value)}
        />
        <span className="char-count">{bio.length} / 500</span>
      </div>

      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── STORY-005: Deathbed Goals Editor ────────────────────────────────────────

export function DeathbedGoalsEditor({ state, updateState }: TabProps) {
  const [goals, setGoals] = useState<string[]>([...state.deathbedGoals]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGoals([...state.deathbedGoals]);
  }, [state.deathbedGoals]);

  const handleChange = (i: number, value: string) =>
    setGoals(prev => prev.map((g, idx) => (idx === i ? value : g)));

  const handleSave = () => {
    updateState({ deathbedGoals: goals });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="section-content">
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
        On your deathbed, what would you regret not doing or being? Answer honestly —
        these anchor everything you plan.
      </p>
      {goals.map((goal, i) => (
        <div className="form-field" key={i}>
          <label htmlFor={`goal-${i}`} className="form-label">Goal {i + 1}</label>
          <textarea
            id={`goal-${i}`}
            className="input-base"
            value={goal}
            maxLength={300}
            rows={2}
            placeholder="What would you regret not doing or being?"
            onChange={e => handleChange(i, e.target.value)}
          />
          <span className="char-count">{goal.length} / 300</span>
        </div>
      ))}
      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save Goals'}
        </button>
      </div>
    </div>
  );
}

// ─── STORY-006: API Key Config ────────────────────────────────────────────────

export function ApiKeyConfig({ state, updateState }: TabProps) {
  const [keyInput,     setKeyInput]     = useState('');
  const [clearing,     setClearing]     = useState(false);
  const [savedMask,    setSavedMask]    = useState<string | null>(null);

  const storedMask = state.apiKey
    ? `sk-ant-...${state.apiKey.slice(-4)}`
    : null;

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    updateState({ apiKey: trimmed });
    setSavedMask(`sk-ant-...${trimmed.slice(-4)}`);
    setKeyInput('');
    setTimeout(() => setSavedMask(null), 3000);
  };

  return (
    <div className="section-content">
      {storedMask && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
          Current key: <code style={{ color: 'var(--color-accent)' }}>{storedMask}</code>
        </p>
      )}
      {!storedMask && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
          No API key saved. Add one to enable the Coach tab.
        </p>
      )}

      <div className="form-field">
        <label htmlFor="api-key" className="form-label">Claude API Key</label>
        <input
          id="api-key"
          type="password"
          className="input-base"
          value={keyInput}
          placeholder="sk-ant-..."
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        />
      </div>

      {savedMask && (
        <p style={{ color: 'var(--color-success)', fontSize: 13, marginBottom: 8 }}>
          Key saved: {savedMask}
        </p>
      )}

      <div className="form-actions">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!keyInput.trim()}
        >
          Save Key
        </button>

        {state.apiKey && !clearing && (
          <button className="btn-ghost" onClick={() => setClearing(true)}>
            Clear Key
          </button>
        )}

        {clearing && (
          <>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              Remove saved key?
            </span>
            <button className="btn-ghost" onClick={() => setClearing(false)}>
              Cancel
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => { updateState({ apiKey: null }); setClearing(false); }}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── STORY-007: Life Dimensions Display ──────────────────────────────────────

export function DimensionsTable({ state }: Pick<TabProps, 'state'>) {
  return (
    <div className="section-content">
      <table className="table-base">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Weight</th>
            <th>Description</th>
            <th>Annual OKRs</th>
          </tr>
        </thead>
        <tbody>
          {LIFE_DIMENSIONS.map(dim => {
            const count = state.annualOKRs.filter(o => o.dimensionId === dim.id).length;
            return (
              <tr key={dim.id}>
                <td style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                  {dim.label}
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>
                  {dim.weightPercent}%
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                  {dim.description}
                </td>
                <td style={{ color: count > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                  {count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 10 }}>
        Add OKRs for each dimension in the <strong style={{ color: 'var(--color-text-primary)' }}>Plan</strong> tab.
      </p>
    </div>
  );
}

// ─── STORY-062: Deathbed goal → dimension mapping picker ─────────────────────

export function DeathbedMappingSection({ state, updateState }: TabProps) {
  const goals    = state.deathbedGoals;
  const mappings = state.deathbedGoalMappings ?? Array(7).fill(null);

  const nonEmptyCount = goals.filter(g => g.trim() !== '').length;
  if (nonEmptyCount === 0) return null;

  const handleChange = (i: number, value: DimensionId | null) => {
    const cur = state.deathbedGoalMappings ?? Array(7).fill(null);
    updateState({
      deathbedGoalMappings: cur.map((v, j) => j === i ? value : v) as (DimensionId | null)[],
    });
  };

  return (
    <div className="section-content">
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 14 }}>
        Map each goal to a life dimension so the Review tab can track alignment.
      </p>
      {goals.map((goal, i) => {
        if (!goal.trim()) return null;
        const truncated = goal.length > 80 ? goal.slice(0, 80) + '…' : goal;
        const current   = mappings[i] ?? null;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <span
              title={goal}
              style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 13, overflow: 'hidden' }}
            >
              {truncated}
            </span>
            <select
              className="input-base"
              style={{ flex: '0 0 180px' }}
              value={current ?? ''}
              onChange={e => {
                const val = e.target.value;
                handleChange(i, val === '' ? null : val as DimensionId);
              }}
            >
              <option value="">No dimension</option>
              {LIFE_DIMENSIONS.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ─── STORY-008: Setup Tab Assembly ───────────────────────────────────────────

const BANNER_DISMISSED_KEY = 'life-compass-welcome-dismissed';

export function SetupTab({ state, updateState }: TabProps) {
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  );

  const profileComplete = state.profile !== null && state.profile.name.trim() !== '';
  const hasAnyGoal      = state.deathbedGoals.some(g => g.trim() !== '');
  // Banner hides when dismissed OR when setup is complete
  const showBanner      = !bannerDismissed && (!profileComplete || !hasAnyGoal);

  const dismissBanner = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setBannerDismissed(true);
  };

  return (
    <div className="setup-tab">
      {showBanner && (
        <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span>
            <strong>Welcome to Life Compass.</strong>{' '}
            {profileComplete
              ? 'Now add at least one deathbed goal — it anchors everything you plan. Then map each goal to a life dimension in the Dimension Mapping section below.'
              : 'Start by filling in your profile and at least one deathbed goal — these anchor everything you plan. Then map each goal to a life dimension in the Dimension Mapping section below.'}
          </span>
          <button
            onClick={dismissBanner}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            title="Dismiss"
          >✕</button>
        </div>
      )}

      <div className="section-divider">Profile</div>
      <ProfileForm state={state} updateState={updateState} />

      <div className="section-divider">Deathbed Goals</div>
      <DeathbedGoalsEditor state={state} updateState={updateState} />

      <div className="section-divider">Dimension Mapping</div>
      <DeathbedMappingSection state={state} updateState={updateState} />

      <div className="section-divider">Coach API Key</div>
      <ApiKeyConfig state={state} updateState={updateState} />

      <div className="section-divider">Life Dimensions</div>
      <DimensionsTable state={state} />
    </div>
  );
}
