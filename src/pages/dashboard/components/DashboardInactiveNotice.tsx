import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardInactiveNoticeProps {
  onSignOut: () => void;
}

export function DashboardInactiveNotice({
  onSignOut,
}: DashboardInactiveNoticeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LogOut className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Cuenta desactivada
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tu acceso al taller ha sido dado de baja. Habla con el administrador
          del equipo si crees que es un error.
        </p>
        <Button type="button" className="mt-5 gap-2" onClick={onSignOut}>
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
