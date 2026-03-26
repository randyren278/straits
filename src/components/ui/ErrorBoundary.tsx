'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. Receives error and reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable error boundary that catches render errors in its subtree.
 * Shows Bloomberg-styled fallback UI by default.
 * Must be a class component — React 19 still requires them for componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Component crash captured:', {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 border border-amber-500/20 bg-black p-8 font-mono"
        >
          <p className="text-xs uppercase tracking-widest text-amber-500/60">
            SYSTEM ERROR
          </p>
          <p className="max-w-md text-center text-sm text-amber-500">
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            className="border border-amber-500/40 bg-transparent px-4 py-1.5 text-xs uppercase tracking-widest text-amber-500 transition-colors hover:border-amber-500 hover:bg-amber-500/10"
          >
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
