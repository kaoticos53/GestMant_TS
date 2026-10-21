import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
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
import { useEditUserForm } from "../hooks/useEditUserForm";
import type { Member } from "../types";

interface EditUserDialogProps {
  member: Member;
  onClose: () => void;
}

/**
 * Diálogo modal para la edición del perfil de un usuario del taller por parte del administrador.
 */
export function EditUserDialog({ member, onClose }: EditUserDialogProps) {
  const {
    name,
    setName,
    position,
    setPosition,
    location,
    setLocation,
    phone,
    setPhone,
    busy,
    error,
    catalogPositions,
    catalogLocations,
    handleSubmit,
  } = useEditUserForm({ member, onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            {member.email ?? "Sin correo de acceso"}
            {member.email ? " · el correo de acceso no se puede cambiar" : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nombre y apellidos *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-position">Puesto</Label>
            <AutocompleteInput
              id="edit-position"
              value={position}
              onChange={setPosition}
              items={catalogPositions}
              kind="position"
              placeholder="p. ej. Audio"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-location">Ubicación</Label>
            <AutocompleteInput
              id="edit-location"
              value={location}
              onChange={setLocation}
              items={catalogLocations}
              kind="equipmentLocation"
              placeholder="p. ej. Plató 2"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Teléfono</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="p. ej. 600 123 456"
              disabled={busy}
            />
          </div>

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
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
