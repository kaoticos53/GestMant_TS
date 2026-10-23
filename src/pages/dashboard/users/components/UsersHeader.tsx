import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export interface UsersHeaderProps {
  onCreateUser: () => void;
}

/**
 * Cabecera de la vista de usuarios con título descriptivo y botón de acción para nuevo usuario.
 */
export function UsersHeader({ onCreateUser }: UsersHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Usuarios del taller
        </h2>
        <p className="text-sm text-muted-foreground">
          Da de alta cuentas, ajusta el puesto y la ubicación de cada persona
          y gestiona quién tiene acceso.
        </p>
      </div>
      <Button type="button" className="gap-2" onClick={onCreateUser}>
        <UserPlus className="size-4" />
        Nuevo usuario
      </Button>
    </div>
  );
}
