import logo from "@/assets/logo.svg";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthMethod } from "../types";

export function AuthHeader({
  method,
  onMethodChange,
  onLogoClick,
}: {
  method: AuthMethod;
  onMethodChange: (method: AuthMethod) => void;
  onLogoClick: () => void;
}) {
  return (
    <CardHeader className="text-center">
      <div className="flex justify-center">
        <img
          src={logo}
          alt="Pulso Taller"
          width={64}
          height={64}
          className="rounded-lg mb-4 mt-4 cursor-pointer"
          onClick={onLogoClick}
        />
      </div>
      <CardTitle className="text-xl">Accede a Pulso Taller</CardTitle>
      <CardDescription>
        {method === "password"
          ? "Entra con tu correo y contraseña"
          : "Introduce tu correo y te enviamos un código"}
      </CardDescription>

      <div className="mt-4 inline-flex w-fit rounded-lg border border-border/70 bg-muted/60 p-1 mx-auto">
        <button
          type="button"
          onClick={() => onMethodChange("password")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "password"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Contraseña
        </button>
        <button
          type="button"
          onClick={() => onMethodChange("email")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "email"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Código por email
        </button>
      </div>
    </CardHeader>
  );
}
