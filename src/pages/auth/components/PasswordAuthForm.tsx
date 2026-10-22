import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordFlow } from "../types";

export function PasswordAuthForm({
  passwordFlow,
  onPasswordFlowChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isLoading,
  onSubmit,
}: {
  passwordFlow: PasswordFlow;
  onPasswordFlowChange: (flow: PasswordFlow) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@empresa.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={
            passwordFlow === "signIn" ? "current-password" : "new-password"
          }
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={isLoading}
        />
        {passwordFlow === "signUp" && (
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {passwordFlow === "signIn" ? "Entrar" : "Crear cuenta"}
      </Button>

      <div className="text-center">
        <Button
          type="button"
          variant="link"
          className="text-xs text-muted-foreground"
          onClick={() =>
            onPasswordFlowChange(
              passwordFlow === "signIn" ? "signUp" : "signIn",
            )
          }
          disabled={isLoading}
        >
          {passwordFlow === "signIn"
            ? "¿No tienes cuenta? Regístrate"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </Button>
      </div>
    </form>
  );
}
