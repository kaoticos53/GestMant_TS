import { Button } from "@/components/ui/button";
import { LogOut, Search, Siren } from "lucide-react";
import { Link } from "react-router";
import { IncidentLookup } from "../../IncidentLookup";
import type { DashboardGuestNoticeProps } from "./types";

export function DashboardGuestNotice({
  searchParamsCode,
  onSwitchAccount,
}: DashboardGuestNoticeProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <Search className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        Sigue o notifica una incidencia
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        Estás en una sesión de invitado: escribe el código que te dieron al
        notificarla para comprobar su estado y seguimiento, o notifica una
        nueva incidencia. La cola de trabajo, las peticiones y el inventario
        están reservados para usuarios con cuenta del taller.
      </p>
      <IncidentLookup
        className="mx-auto mt-5 max-w-md"
        initialCode={searchParamsCode}
      />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="gap-2">
          <Link to="/reportar">
            <Siren className="size-4" />
            Notificar una incidencia
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onSwitchAccount}
        >
          <LogOut className="size-4" />
          Entrar con mi cuenta
        </Button>
      </div>
    </div>
  );
}
