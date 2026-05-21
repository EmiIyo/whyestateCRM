import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F5F7FA' }}>
        <div className="max-w-md w-full bg-white rounded-2xl border p-6 text-center" style={{ borderColor: '#FECACA' }}>
          <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#FEE2E2' }}>
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-base font-bold mb-1" style={{ color: '#1A202C' }}>Something went wrong</h2>
          <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={this.reset}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
              style={{ background: '#1EC9C4' }}>
              Try again
            </button>
            <button onClick={() => window.location.assign('/')}
              className="px-4 py-1.5 rounded-xl text-xs font-medium border hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
