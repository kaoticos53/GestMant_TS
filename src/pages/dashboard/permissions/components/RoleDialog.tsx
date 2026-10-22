import { useState } from "react";
import { useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { ADMIN_KEY } from "@/lib/permissionsDraft";
import { DEFAULT_ROLE } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import type { DialogState, RoleInfo } from "../types";

export interface RoleDialogProps {
  state: NonNullable<DialogState>;
  roles: RoleInfo[];
  onClose: () => void;
}

/**
 * Modal accesible para el alta, renombrado y duplicación de roles personalizados del taller.
 */
export function RoleDialog({ state, roles, onClose }: RoleDialogProps) {
  const createRole = useMutation(api.permissions.createRole);
  const updateRole = useMutation(api.permissions.updateRole);
  const isEdit = state.mode === "edit" && state.role !== undefined;

  const [label, setLabel] = useState(
    isEdit
      ? state.role!.label
      : state.template
        ? `${state.template.label} (copia)`
        : "",
  );
  const [description, setDescription] = useState(
    isEdit ? state.role!.description : (state.template?.description ?? ""),
  );
  const [templateKey, setTemplateKey] = useState(
    state.template?.key ?? DEFAULT_ROLE,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateOptions = roles.filter((role) => role.key !== ADMIN_KEY);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isEdit && state.role) {
        await updateRole({ key: state.role.key, label, description });
        toast.success("Rol actualizado");
      } else {
        const key = await createRole({ label, description, templateKey });
        toast.success(`Rol «${label}» creado (clave «${key}»)`);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            {isEdit
              ? "Editar rol"
              : state.template
                ? "Duplicar rol"
                : "Nuevo rol"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cambia el nombre visible y la descripción. La clave con la que se guarda el rol no cambia."
              : "El nombre genera la clave única del rol; partimos de los permisos de otro rol para empezar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="role-label">Nombre del rol *</Label>
            <Input
              id="role-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="p. ej. Auxiliar de almacén"
              maxLength={60}
              disabled={busy}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">Descripción</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué hace este rol en el taller"
              rows={2}
              maxLength={160}
              disabled={busy}
            />
          </div>

          {!isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="role-template">Partir de los permisos de</Label>
              <Select
                value={templateKey}
                onValueChange={setTemplateKey}
                disabled={busy}
              >
                <SelectTrigger id="role-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={busy}>
              {busy ? "Guardando..." : isEdit ? "Guardar rol" : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
