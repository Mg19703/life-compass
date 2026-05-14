import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearState } from '../storage';

interface Props {
  children: ReactNode;
  // When true, wraps a single tab — shows a lighter recovery UI
  tabLevel?: boolean;
}

interface State {
  hasError: boolean;
  confirming: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, confirming: false };

  static getDerivedStateFromError(): State {
    return { hasError: true, confirming: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[life-compass] render error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRequestReset = () => {
    this.setState({ confirming: true });
  };

  private handleConfirmReset = () => {
    clearState();
    window.location.reload();
  };

  private handleCancelReset = () => {
    this.setState({ confirming: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { confirming } = this.state;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
        color: 'var(--color-text-primary)',
      }}>
        <p style={{ color: 'var(--color-text-muted)' }}>
          {this.props.tabLevel
            ? 'This tab encountered an error.'
            : 'Something went wrong. Reload the app to recover.'}
        </p>

        {confirming ? (
          <>
            <p style={{ color: 'var(--color-danger)', fontSize: '13px' }}>
              This will erase all your data. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={this.handleCancelReset}>
                Cancel
              </button>
              <button className="btn-primary" onClick={this.handleConfirmReset}
                style={{ background: 'var(--color-danger)' }}>
                Reset &amp; reload
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={this.handleReload}>
              Reload
            </button>
            <button className="btn-ghost" onClick={this.handleRequestReset}>
              Reset &amp; reload
            </button>
          </div>
        )}
      </div>
    );
  }
}
