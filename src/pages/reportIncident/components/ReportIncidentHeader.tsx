import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { Home } from "lucide-react";
import { Link } from "react-router";

export function ReportIncidentHeader() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Pulso Taller"
            className="size-8 rounded-lg ring-1 ring-border"
          />
          <span className="text-sm font-semibold tracking-tight">
            Pulso Taller
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/">
            <Home className="size-3.5" />
            Inicio
          </Link>
        </Button>
      </div>
    </header>
  );
}
