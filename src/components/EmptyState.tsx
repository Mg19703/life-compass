interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '32px 16px',
      color: 'var(--color-text-muted)',
      fontStyle: 'italic',
    }}>
      {message}
    </div>
  );
}
