import type { CSSProperties } from 'react';

interface DateNavBarProps {
  label: string;
  sublabel?: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onToday?: () => void;
  style?: CSSProperties;
}

export function DateNavBar({ label, sublabel, onPrev, onNext, prevDisabled, nextDisabled, onToday, style }: DateNavBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, ...style }}>
      <button className="btn-ghost" style={{ padding: '4px 10px', flexShrink: 0 }}
        disabled={prevDisabled} onClick={onPrev}>←</button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {sublabel && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 8 }}>{sublabel}</span>
        )}
      </div>
      <button className="btn-ghost" style={{ padding: '4px 10px', flexShrink: 0 }}
        disabled={nextDisabled} onClick={onNext}>→</button>
      {onToday && (
        <button className="btn-ghost" style={{ fontSize: 12, flexShrink: 0 }} onClick={onToday}>Today</button>
      )}
    </div>
  );
}
