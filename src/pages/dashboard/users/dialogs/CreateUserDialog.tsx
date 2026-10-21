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
import { UserPlus } from "lucide-react";
import { useCreateUserForm } from "../hooks/useCreateUserForm";

interface CreateUserDialogProps {
  onClose: () => void;
}

/**
 * Diálogo modal para dar de alta a una nueva persona y su cuenta de acceso.
 */
export function CreateUserDialog({ onClose }: CreateUserDialogProps) {
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
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
    roleOptions,
    handleSubmit,
  } = useCreateUserForm({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Dar de alta a un usuario
          </DialogTitle>
          <DialogDescription>
            Crea su ficha en el taller y su cuenta de acceso. Podrá entrar con
            su correo y esta contraseña desde la página de acceso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nombre y apellidos *</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sandra Ruiz"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Correo de acceso *</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sandra@taller.es"
                autoComplete="off"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Contraseña inicial *</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Rol</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value)}
                disabled={busy}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(roleOptions ?? []).map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-position">Puesto</Label>
              <Input
                id="user-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="p. ej. Cámara"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-location">Ubicación</Label>
              <Input
                id="user-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="p. ej. Plató 1"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="user-phone">Teléfono</Label>
              <Input
                id="user-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="p. ej. 600 123 456"
                disabled={busy}
              />
            </div>
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
            <Button type="submit" className="gap-2" disabled={busy}>
              {busy ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
