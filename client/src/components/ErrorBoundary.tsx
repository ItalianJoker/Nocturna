/**
 * Catch render crashes so Host lobby never dies as a silent black screen.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Nocturna] UI crash', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-shell gap-4">
          <p className="fluid-label text-rose-400">Nocturna</p>
          <h1 className="font-display fluid-h2 text-[var(--nocturna-paper)]">
            Something went wrong
          </h1>
          <p className="fluid-body text-stone-400">
            The lobby UI crashed. Reload the page or reopen the room. If this
            keeps happening after editing the deck, update to the latest Host
            build.
          </p>
          <pre className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-rose-200">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="btn-primary max-w-xs"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
