import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ModuleErrorBoundaryProps {
  children: ReactNode;
  /** Nombre del módulo o sección (para contextualizar el mensaje al usuario) */
  moduleName?: string;
  /** Título personalizado */
  title?: string;
  /** UI alternativa personalizada */
  fallback?: ReactNode;
  /** Callback invocado cuando el usuario solicita reintentar */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary granular para aislar fallos de renderizado en vistas,
 * diálogos y fichas laterales (Sheets), evitando que un error puntual
 * en un módulo derribe toda la aplicación.
 */
export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  State
> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ModuleErrorBoundary] Error capturado en el módulo "${
        this.props.moduleName ?? "desconocido"
      }":`,
      error,
      errorInfo,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const module = this.props.moduleName ?? "este módulo";
      const title = this.props.title ?? `Error al cargar ${module}`;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="my-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-foreground shadow-sm"
        >
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se ha producido un problema inesperado al renderizar {module}.
                Puedes reintentar la acción o volver al panel principal.
              </p>

              {this.state.error?.message && (
                <details className="mt-3 rounded-md bg-card/60 p-2.5 text-xs text-muted-foreground border border-border/60">
                  <summary className="cursor-pointer font-medium hover:text-foreground">
                    Detalles técnicos del error
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-destructive">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RotateCcw className="size-3.5" />
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
