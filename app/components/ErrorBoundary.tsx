"use client";
import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  /** Enable detailed error display in development */
  showDetails?: boolean;
  /** Custom error boundary name for logging */
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second base delay

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store error info for detailed reporting
    this.setState({ errorInfo });
    
    // Log to console with formatting for debugging
    console.error(`[ErrorBoundary${this.props.name ? ` (${this.props.name})` : ''}] Error caught:`, error);
    if (errorInfo?.componentStack) {
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Here you could integrate with error reporting services like Sentry:
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = (): void => {
    const { retryCount } = this.state;
    
    if (retryCount >= ErrorBoundary.MAX_RETRIES) {
      console.warn("[ErrorBoundary] Max retries reached. Please refresh the page.");
      return;
    }

    // Exponential backoff for retry delay
    const delay = ErrorBoundary.RETRY_DELAY_BASE * Math.pow(2, retryCount);
    console.log(`[ErrorBoundary] Retrying in ${delay}ms (attempt ${retryCount + 1}/${ErrorBoundary.MAX_RETRIES})`);

    setTimeout(() => {
      this.setState(prev => ({ 
        hasError: false, 
        error: null, 
        errorInfo: null, 
        retryCount: prev.retryCount + 1 
      }));
      
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    }, delay);
  };

  handleReset = (): void => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      retryCount: 0 
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { error, errorInfo, retryCount } = this.state;
      const isDev = process.env.NODE_ENV === "development";
      const canRetry = retryCount < ErrorBoundary.MAX_RETRIES;

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#e0e0e0",
            fontFamily: "'Courier New', monospace",
            padding: "20px",
            textAlign: "center",
            zIndex: 999999,
          }}
        >
          {/* Header */}
          <div style={{ 
            marginBottom: "30px",
            padding: "20px 40px",
            border: "1px solid #ff4444",
            borderRadius: "4px",
            background: "rgba(255, 68, 68, 0.1)"
          }}>
            <h1 style={{ 
              color: "#ff4444", 
              marginBottom: "10px", 
              fontSize: "1.8rem",
              fontWeight: "bold",
              letterSpacing: "0.1em"
            }}>
              ⚠ SYSTEM FAILURE
            </h1>
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              An unexpected error has occurred
            </p>
          </div>

          {/* Error Details - Show in development */}
          {(isDev || this.props.showDetails) && error && (
            <details
              style={{
                marginBottom: "30px",
                maxWidth: "600px",
                width: "100%",
                textAlign: "left",
                padding: "15px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
              }}
            >
              <summary style={{ 
                cursor: "pointer", 
                color: "#ff8844",
                marginBottom: "10px",
                fontWeight: "bold"
              }}>
                🔍 Error Details
              </summary>
              <div style={{ 
                color: "#ff6666", 
                fontSize: "0.85rem",
                wordBreak: "break-word",
                fontFamily: "monospace"
              }}>
                <strong>Message:</strong> {error.message}
              </div>
              {errorInfo?.componentStack && (
                <pre style={{ 
                  marginTop: "10px", 
                  padding: "10px", 
                  background: "rgba(0,0,0,0.3)",
                  overflow: "auto",
                  fontSize: "0.75rem",
                  color: "#aaa",
                  textAlign: "left"
                }}>
                  {errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center" }}>
            {canRetry && (
              <button
                onClick={this.handleRetry}
                aria-label="Retry loading the component"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: "#fff",
                  padding: "14px 28px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                }}
              >
                RETRY ({retryCount}/{ErrorBoundary.MAX_RETRIES})
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              aria-label="Refresh the page"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                padding: "14px 28px",
                cursor: "pointer",
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              }}
            >
              REFRESH
            </button>

            <button
              onClick={this.handleReset}
              aria-label="Dismiss error and retry"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#aaa",
                padding: "14px 28px",
                cursor: "pointer",
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                fontSize: "0.9rem",
                transition: "all 0.2s ease",
              }}
            >
              DISMISS
            </button>
          </div>

          {/* Status indicator */}
          {!canRetry && (
            <p style={{ 
              marginTop: "20px", 
              color: "#ff8844", 
              fontSize: "0.85rem" 
            }}>
              Maximum retry attempts reached. Please refresh the page.
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper component for wrapping async operations with error handling
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}