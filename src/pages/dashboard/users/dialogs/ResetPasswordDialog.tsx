import { useState } from "react";
import { useAction } from "convex/react";
import { Copy, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { generateSecurePassword, validatePassword } from "@/lib/password";
import { getErrorMessage } from "@/lib/workshop";
import type { Member } from "../types";

export function ResetPasswordDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const resetUserPassword = useAction(api.members.resetUserPassword);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    const generated = generateSecurePassword();
    setPassword(generated);
    setShowPassword(true);
    setError(null);
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Contraseña copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar la contraseña automáticamente");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetUserPassword({ userId: member._id, newPassword: password });
      toast.success(
        `Contraseña restablecida para ${member.name ?? member.email}`,
        {
          description: "Se han cerrado todas las sesiones activas de la cuenta.",
        },
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Restablecer contraseña
          </DialogTitle>
          <DialogDescription>
            Asigna una nueva contraseña para{" "}
            <strong>{member.name ?? member.email}</strong> ({member.email}). Se
            cerrarán todas sus sesiones activas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="reset-password-input">Nueva contraseña *</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={handleGenerate}
                  disabled={busy}
                >
                  <Sparkles className="size-3.5" />
                  Generar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => void handleCopy()}
                  disabled={busy || !password}
                >
                  <Copy className="size-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id="reset-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="pr-10 font-mono"
                disabled={busy}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
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
              {busy ? "Restableciendo..." : "Restablecer contraseña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
