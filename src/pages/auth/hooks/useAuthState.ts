import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { resolveRedirectAfterAuth } from "../helpers";
import type { AuthMethod, PasswordFlow, OtpStep } from "../types";

export function useAuthState({
  redirectAfterAuth,
}: {
  redirectAfterAuth?: string;
} = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // Acceso con contraseña (cuenta de administrador) o con código por email
  const [method, setMethod] = useState<AuthMethod>("password");
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Flujo OTP por email
  const [step, setStep] = useState<OtpStep>("signIn");
  const [otp, setOtp] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void navigate(redirect, { replace: true });
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
    } catch (err) {
      console.error("Password sign-in error:", err);
      const raw = err instanceof Error ? err.message : "";
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
            : `No se ha podido crear la cuenta (mínimo 8 caracteres de contraseña)${
                raw ? `: ${raw}` : "."
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
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
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
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("El código de verificación introducido no es correcto.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const resetToEmail = () => {
    setStep("signIn");
    setError(null);
  };

  const switchMethod = (newMethod: AuthMethod) => {
    setMethod(newMethod);
    setError(null);
  };

  return {
    navigate,
    method,
    switchMethod,
    passwordFlow,
    setPasswordFlow,
    email,
    setEmail,
    password,
    setPassword,
    step,
    otp,
    setOtp,
    isLoading,
    error,
    setError,
    handlePasswordSubmit,
    handleEmailSubmit,
    handleOtpSubmit,
    resetToEmail,
  };
}
