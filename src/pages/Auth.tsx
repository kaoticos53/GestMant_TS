import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

type Method = "password" | "email";

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // Acceso con contraseña (cuenta de administrador) o con código por email
  const [method, setMethod] = useState<Method>("password");
  const [passwordFlow, setPasswordFlow] = useState<"signIn" | "signUp">(
    "signIn",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Flujo OTP por email
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const submit = async (flow: "signIn" | "signUp") => {
      const formData = new FormData();
      formData.set("email", email.trim());
      formData.set("password", password);
      formData.set("flow", flow);
      await signIn("password", formData);
    };

    try {
      await submit(passwordFlow);
      navigate(redirect);
    } catch (error) {
      console.error("Password sign-in error:", error);
      const raw = error instanceof Error ? error.message : "";
      // @convex-dev/auth distingue: cuenta inexistente (InvalidAccountId),
      // contraseña errónea (InvalidSecret) o cuenta duplicada (already exists).
      const accountMissing = raw.includes("InvalidAccountId");
      const badSecret =
        raw.includes("InvalidSecret") || raw.includes("Invalid credentials");
      const accountExists = raw.includes("already") || raw.includes("exists");


      if (passwordFlow === "signUp") {
        setError(
          accountExists
            ? "Ya existe una cuenta con ese correo. Cambia a «Entrar»."
            : `No se ha podido crear la cuenta (mínimo 8 caracteres de contraseña)${raw ? `: ${raw}` : "."
            }`,
        );
      } else if (badSecret) {
        setError("El correo o la contraseña no son correctos.");
      } else if (accountMissing) {
        setError(
          "No existe ninguna cuenta con ese correo. Pulsa «Crear cuenta» para darte de alta.",
        );
      } else {
        setError(`No se ha podido iniciar sesión${raw ? `: ${raw}` : "."}`);
      }
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "No se ha podido enviar el código de verificación. Inténtalo de nuevo.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("El código de verificación introducido no es correcto.");
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex items-center justify-center h-full flex-col w-full">
          <Card className="w-full max-w-[380px] pb-0 border shadow-md">
            <CardHeader className="text-center">
              <div className="flex justify-center">
                <img
                  src={logo}
                  alt="Pulso Taller"
                  width={64}
                  height={64}
                  className="rounded-lg mb-4 mt-4 cursor-pointer"
                  onClick={() => navigate("/")}
                />
              </div>
              <CardTitle className="text-xl">Accede a Pulso Taller</CardTitle>
              <CardDescription>
                {method === "password"
                  ? "Entra con tu correo y contraseña"
                  : "Introduce tu correo y te enviamos un código"}
              </CardDescription>

              <div className="mt-4 inline-flex w-fit rounded-lg border border-border/70 bg-muted/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("password");
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${method === "password"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Contraseña
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("email");
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${method === "email"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Código por email
                </button>
              </div>
            </CardHeader>

            {method === "password" ? (
              <form onSubmit={handlePasswordSubmit}>
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
                      onChange={(event) => setEmail(event.target.value)}
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
                        passwordFlow === "signUp"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
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
                        {passwordFlow === "signUp"
                          ? "Creando cuenta..."
                          : "Entrando..."}
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
                          onClick={() => {
                            setPasswordFlow("signIn");
                            setError(null);
                          }}
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
                          onClick={() => {
                            setPasswordFlow("signUp");
                            setError(null);
                          }}
                        >
                          Crear cuenta
                        </button>
                      </>
                    )}
                  </p>
                </CardContent>
              </form>
            ) : step === "signIn" ? (
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="grid gap-3">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="nombre@empresa.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </CardContent>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="grid gap-3 pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive text-center">
                      {error}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    ¿No has recibido el código?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setStep("signIn")}
                    >
                      Reenviar
                    </Button>
                  </p>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Verificar código
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Usar otro correo
                  </Button>
                </CardContent>
              </form>
            )}

            <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
              ©2026 RGLara
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
