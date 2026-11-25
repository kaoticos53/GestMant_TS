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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditUserForm } from "../hooks/useEditUserForm";
import type { Member, RoleOption } from "../types";

interface EditUserDialogProps {
  member: Member;
  roleOptions?: RoleOption[];
  isSelf?: boolean;
  onClose: () => void;
}

/**
 * Diálogo modal para la edición del perfil de un usuario del taller por parte del administrador.
 */
export function EditUserDialog({
  member,
  roleOptions = [],
  isSelf = false,
  onClose,
}: EditUserDialogProps) {
  const {
    name,
    setName,
    role,
    setRole,
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
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
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
          {roleOptions.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Select
                value={role}
                onValueChange={setRole}
                disabled={busy || isSelf}
              >
                <SelectTrigger id="edit-role" className="w-full">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-xs text-muted-foreground">
                  No puedes cambiar tu propio rol desde aquí.
                </p>
              )}
            </div>
          )}
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
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="p. ej. 600 123 456"
              disabled={busy}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

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
