import { useState } from 'react';

// ─── STORY-055: Tool action proposal card ─────────────────────────────────────
// Purely presentational — no AppState imports.
// Rendered by CoachTab (STORY-056) when callCoachWithTools returns {type:'tool_use'}.

interface ToolProposalCardProps {
  toolName: string;
  toolInput: unknown;
  isDestructive: boolean;
  /** Human-readable name of the item being deleted — shown in the second-step prompt */
  destructiveLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function buildSummary(toolName: string, toolInput: unknown): string {
  try {
    const i = (typeof toolInput === 'object' && toolInput !== null
      ? toolInput : {}) as Record<string, unknown>;
    const text = typeof i.text === 'string' ? `"${i.text}"` : null;
    const dim  = typeof i.dimensionId === 'string'
      ? i.dimensionId.replace(/-/g, ' ') : null;
    const q    = typeof i.quarter === 'string' ? i.quarter : null;
    const yr   = typeof i.year   === 'number' ? i.year   : null;
    const mo   = typeof i.month  === 'number' ? i.month  : null;

    switch (toolName) {
      case 'create_annual_goal':
        return `Create annual goal${text ? `: ${text}` : ''}${dim ? ` · ${dim}` : ''}`;
      case 'edit_annual_goal':
        return `Edit annual goal${text ? ` → ${text}` : ''}`;
      case 'delete_annual_goal':
        return 'Delete annual goal';
      case 'create_quarterly_objective':
        return `Create quarterly objective${text ? `: ${text}` : ''}${q && yr ? ` · ${q} ${yr}` : ''}`;
      case 'edit_quarterly_objective':
        return `Edit quarterly objective${text ? ` → ${text}` : ''}`;
      case 'delete_quarterly_objective':
        return 'Delete quarterly objective';
      case 'create_monthly_kr':
        return `Create key result${text ? `: ${text}` : ''}${mo && yr ? ` · ${mo}/${yr}` : ''}`;
      case 'edit_monthly_kr':
        return `Edit key result${text ? ` → ${text}` : ''}`;
      case 'delete_monthly_kr':
        return 'Delete key result';
      case 'edit_mit':
        return `Edit task${text ? `: ${text}` : ''}`;
      case 'delete_mit':
        return 'Delete task';
      default:
        return `Proposed action: ${toolName}`;
    }
  } catch {
    return `Proposed action: ${toolName}`;
  }
}

export function ToolProposalCard({
  toolName, toolInput, isDestructive, destructiveLabel, onConfirm, onCancel,
}: ToolProposalCardProps) {
  const [step, setStep] = useState<'initial' | 'confirming' | 'applying'>('initial');
  const summary  = buildSummary(toolName, toolInput);
  const applying = step === 'applying';

  const handleFirstConfirm = () => {
    if (isDestructive) {
      setStep('confirming');
    } else {
      setStep('applying');
      onConfirm();
    }
  };

  const handleFinalConfirm = () => {
    setStep('applying');
    onConfirm();
  };

  return (
    <div style={{
      background: 'var(--color-bg)',
      border: '1px solid var(--color-border)',
      borderRadius: 6,
      padding: '12px 16px',
      maxWidth: 520,
      fontSize: 13,
    }}>
      <p style={{ color: 'var(--color-text-primary)', lineHeight: 1.55, marginBottom: 12 }}>
        {summary}
      </p>

      {/* Initial step — or applying state for non-destructive */}
      {step !== 'confirming' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primary"
            disabled={applying}
            onClick={handleFirstConfirm}
          >
            {applying
              ? (isDestructive ? 'Deleting…' : 'Applying…')
              : (isDestructive ? 'Delete'    : 'Confirm')}
          </button>
          <button className="btn-ghost" disabled={applying} onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {/* Second-step destructive confirmation — inline below summary */}
      {step === 'confirming' && (
        <div>
          <p style={{ color: 'var(--color-danger)', fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
            This will permanently delete{' '}
            {destructiveLabel ? `"${destructiveLabel}"` : 'this item'}{' '}
            and all its children. Confirm delete?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={handleFinalConfirm}
            >
              Confirm delete
            </button>
            <button className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
