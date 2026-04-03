import React from 'react';

type Props = {
  title: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }

  componentDidCatch() {
    // Intentionally no-op: message is rendered via getDerivedStateFromError.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-4 rounded-2xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs font-mono h-full flex flex-col justify-center items-center text-center">
        <div className="font-black uppercase tracking-widest mb-2 opacity-80">{this.props.title} Failure</div>
        <div className="opacity-70 break-words max-w-full font-bold">
          {this.state.message}
        </div>
      </div>
    );
  }
}
