import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthMethod, PasswordFlow } from "../types";

export function AuthHeader({
  method,
  onMethodChange,
  passwordFlow,
}: {
  method: AuthMethod;
  onMethodChange: (method: AuthMethod) => void;
  passwordFlow: PasswordFlow;
}) {
  return (
    <CardHeader className="space-y-4 text-center">
      <div className="flex justify-center">
        <img
          src={logo}
          alt="Pulso Taller"
          className="size-16 rounded-2xl border border-border/60 bg-muted/30 p-2 shadow-xs"
        />
      </div>
      <div className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Pulso Taller
        </CardTitle>
        <CardDescription>
          {method === "password"
            ? passwordFlow === "signIn"
              ? "Inicia sesión con tu cuenta"
              : "Crea una cuenta nueva"
            : "Recibe un código de acceso temporal en tu correo"}
        </CardDescription>
      </div>

      {/* Selector de método de acceso */}
      <div
        role="tablist"
        aria-label="Método de acceso"
        className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1 text-xs"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={method === "password"}
          variant={method === "password" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => onMethodChange("password")}
        >
          Contraseña
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={method === "email"}
          variant={method === "email" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => onMethodChange("email")}
        >
          Código por email
        </Button>
      </div>
    </CardHeader>
  );
}
