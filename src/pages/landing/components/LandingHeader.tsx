import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { CONTENEDOR } from "../constants";

/**
 * Cabecera de navegación principal con identidad visual y acceso según sesión.
 */
export function LandingHeader() {
  const { isLoading, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !isLoading;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className={CONTENEDOR}>
        <div className="flex h-16 items-center justify-between gap-4">
          <a
            href="#inicio"
            className="group flex items-center gap-3 transition-opacity hover:opacity-95"
          >
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-9 rounded-lg shadow-sm ring-1 ring-border transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                Pulso Taller
                <span className="hidden font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-signal sm:inline-block">
                  Broadcast TV
                </span>
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                Mantenimiento de Televisión
              </span>
            </div>
          </a>

          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to="/dashboard">
                  <span>Ir al panel</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Link to="/auth">Acceso técnicos</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
