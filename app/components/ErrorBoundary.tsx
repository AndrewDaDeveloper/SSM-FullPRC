"use client";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            color: "#fff",
            fontFamily: "monospace",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#ff4444", marginBottom: "20px", fontSize: "1.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#888", marginBottom: "30px", maxWidth: "400px" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              padding: "12px 24px",
              cursor: "pointer",
              fontFamily: "monospace",
              letterSpacing: "0.1em",
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}