import type { ReactNode } from 'react';

export interface ProposalCardSection {
  label: string;
  content: string;
  action?: ReactNode;
}

interface ProposalCardProps {
  title: string;
  sections: ProposalCardSection[];
}

// Renders null when sections is empty — callers must not pass an empty array.
export function ProposalCard({ title, sections }: ProposalCardProps) {
  if (sections.length === 0) return null;

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderLeft: '4px solid var(--color-accent)', // must come after border shorthand or accent color is overridden
      borderRadius: 4,
      background: 'var(--color-surface)',
      padding: '12px 16px',
      maxWidth: 560,
    }}>
      <p style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
        {title}
      </p>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: i < sections.length - 1 ? 12 : 0 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
            {s.label}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <p style={{ fontSize: 13, lineHeight: 1.55, flex: 1 }}>{s.content}</p>
            {s.action && <div style={{ flexShrink: 0 }}>{s.action}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
