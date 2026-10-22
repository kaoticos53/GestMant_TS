import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
  error,
  isLoading,
  onSubmit,
}: {
  passwordFlow: PasswordFlow;
  onPasswordFlowChange: (flow: PasswordFlow) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <CardContent className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="login-email">Correo</Label>
          <Input
            id="login-email"
            name="email"
            placeholder="nombre@empresa.com"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">Contraseña</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete={
              passwordFlow === "signUp" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            disabled={isLoading}
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {passwordFlow === "signUp" ? "Creando cuenta..." : "Entrando..."}
            </>
          ) : passwordFlow === "signUp" ? (
            <>
              Crear cuenta
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Entrar
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          {passwordFlow === "signUp" ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                className="text-foreground underline underline-offset-2"
                onClick={() => onPasswordFlowChange("signIn")}
              >
                Entrar
              </button>
            </>
          ) : (
            <>
              ¿Primera vez?{" "}
              <button
                type="button"
                className="text-foreground underline underline-offset-2"
                onClick={() => onPasswordFlowChange("signUp")}
              >
                Crear cuenta
              </button>
            </>
          )}
        </p>
      </CardContent>
    </form>
  );
}
