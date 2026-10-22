import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
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
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/workshop";
import type { EditProfileDialogProps } from "../types";

/** Edita el perfil de la persona que tiene la sesión (nunca el rol). */
export function EditProfileDialog({
  user,
  onClose,
}: EditProfileDialogProps) {
  const updateProfile = useMutation(api.members.updateProfile);
  const catalogPositions = useQuery(api.catalogs.list, { kind: "position" }) ?? [];
  const catalogLocations = useQuery(api.catalogs.list, { kind: "equipmentLocation" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);
  const [name, setName] = useState(user.name ?? "");
  const [position, setPosition] = useState(user.position ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Indica tu nombre y apellidos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        name: name.trim(),
        // Cadena vacía = limpiar el dato de la ficha.
        position,
        location,
        phone,
      });

      // Registro transparente en catálogos
      if (position.trim()) {
        void ensureCatalogItem({ kind: "position", name: position.trim() }).catch(() => {});
      }
      if (location.trim()) {
        void ensureCatalogItem({ kind: "equipmentLocation", name: location.trim() }).catch(() => {});
      }

      toast.success("Perfil actualizado");
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
          <DialogTitle>Editar mi perfil</DialogTitle>
          <DialogDescription>
            Tu nombre, puesto y datos de contacto. El rol lo gestiona el
            administrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Nombre y apellidos *</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-position">Puesto</Label>
            <AutocompleteInput
              id="profile-position"
              value={position}
              onChange={setPosition}
              items={catalogPositions}
              kind="position"
              placeholder="p. ej. Realización"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-location">Ubicación</Label>
            <AutocompleteInput
              id="profile-location"
              value={location}
              onChange={setLocation}
              items={catalogLocations}
              kind="equipmentLocation"
              placeholder="p. ej. Plató 2 · Sala de realización"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
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
