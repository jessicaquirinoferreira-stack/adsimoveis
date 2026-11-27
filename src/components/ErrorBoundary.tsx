import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Ocorreu um erro inesperado na interface.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--canvas-bg)] text-[var(--ink-primary)]">
          <div className="max-w-lg w-full bg-[var(--surface-bg)] border border-[var(--border-color)] rounded-xl p-8 space-y-4">
            <p className="text-xs uppercase tracking-widest text-[var(--ink-muted)]">
              A D S Imóveis · CRECI 226079-F
            </p>
            <h1 className="font-display text-3xl font-semibold">
              Não foi possível carregar esta visualização
            </h1>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90 transition-opacity"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
