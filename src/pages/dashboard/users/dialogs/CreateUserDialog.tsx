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
import { generateSecurePassword } from "@/lib/password";
import { Check, Copy, Eye, EyeOff, KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { RolesChecklist } from "../components/RolesMultiSelect";
import { useCreateUserForm } from "../hooks/useCreateUserForm";

interface CreateUserDialogProps {
  onClose: () => void;
}

/**
 * Diálogo modal para dar de alta a una nueva persona y su cuenta de acceso.
 */
export function CreateUserDialog({ onClose }: CreateUserDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    roles,
    setRoles,
    position,
    setPosition,
    location,
    setLocation,
    phone,
    setPhone,
    busy,
    error,
    roleOptions,
    catalogPositions,
    catalogLocations,
    handleSubmit,
  } = useCreateUserForm({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
            <div className="grid gap-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="user-password">Contraseña inicial *</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={busy}
                    onClick={() => {
                      const generated = generateSecurePassword();
                      setPassword(generated);
                      setShowPassword(true);
                      setCopied(false);
                    }}
                  >
                    <KeyRound className="size-3" />
                    Generar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={busy || password.length === 0}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(password);
                      setCopied(true);
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-emerald-600" />
                        Copiada
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setCopied(false);
                  }}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className="pr-9"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Roles asignados</Label>
              <RolesChecklist
                roleOptions={roleOptions ?? []}
                selectedRoles={roles}
                onChange={setRoles}
                disabled={busy}
                idPrefix="create-user-role"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-position">Puesto</Label>
              <AutocompleteInput
                id="user-position"
                value={position}
                onChange={setPosition}
                items={catalogPositions}
                kind="position"
                placeholder="p. ej. Cámara"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-location">Ubicación</Label>
              <AutocompleteInput
                id="user-location"
                value={location}
                onChange={setLocation}
                items={catalogLocations}
                kind="equipmentLocation"
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
