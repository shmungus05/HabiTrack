import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Habitat Trace ErrorBoundary] Caught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl glass-panel border border-red-200 bg-red-50/50 my-4 space-y-3">
          <div className="flex items-center gap-2.5 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm">
              {this.props.fallbackTitle || "Application view recovered from an error"}
            </h3>
          </div>
          <p className="text-xs text-red-600 font-mono">
            {this.state.error?.message || "An unexpected rendering fault occurred."}
          </p>
          <Button
            size="sm"
            variant="default"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload View
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
