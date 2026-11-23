import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AxiomMark } from './Brand.js';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'The app failed to render',
      detail: error.message,
      componentStack: info.componentStack,
      time: new Date().toISOString(),
    }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="boot-error" role="alert">
        <AxiomMark />
        <h1>Something went wrong</h1>
        <p>Your saved progress is safe. Reload the page to pick up where you left off.</p>
        <div className="error-boundary-actions">
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>Reload the page</button>
          <button className="button button-secondary" type="button" onClick={() => { window.location.href = '/'; }}>Back to start</button>
        </div>
      </div>
    );
  }
}
