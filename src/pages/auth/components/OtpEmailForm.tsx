import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import type { OtpStep } from "../types";

export function OtpEmailForm({
  step,
  email,
  onEmailChange,
  otp,
  onOtpChange,
  isLoading,
  resendCountdown,
  onRequestCode,
  onVerifyCode,
  onResendCode,
  onChangeEmail,
}: {
  step: OtpStep;
  email: string;
  onEmailChange: (value: string) => void;
  otp: string;
  onOtpChange: (value: string) => void;
  isLoading: boolean;
  resendCountdown: number;
  onRequestCode: (e: React.FormEvent<HTMLFormElement>) => void;
  onVerifyCode: (e: React.FormEvent<HTMLFormElement>) => void;
  onResendCode: () => void;
  onChangeEmail: () => void;
}) {
  if (step === "signIn") {
    return (
      <form onSubmit={onRequestCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp-email">Correo electrónico</Label>
          <Input
            id="otp-email"
            name="email"
            type="email"
            placeholder="tu@empresa.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Te enviaremos un código de 6 dígitos que caduca en 15 minutos
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Mail className="mr-2 size-4" />
          )}
          Enviar código de acceso
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onVerifyCode} className="space-y-4">
      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          Hemos enviado un código de acceso a:
        </p>
        <p className="font-mono text-sm font-semibold">{step.email}</p>
      </div>

      <div className="flex justify-center py-2">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={onOtpChange}
          disabled={isLoading}
          autoFocus
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || otp.length !== 6}
      >
        {isLoading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-2 size-4" />
        )}
        Verificar y entrar
      </Button>

      <div className="flex flex-col gap-1 text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          disabled={isLoading || resendCountdown > 0}
          onClick={onResendCode}
        >
          {resendCountdown > 0
            ? `Reenviar código en ${resendCountdown}s`
            : "¿No te ha llegado? Reenviar código"}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-xs text-muted-foreground"
          disabled={isLoading}
          onClick={onChangeEmail}
        >
          Usar otro correo
        </Button>
      </div>
    </form>
  );
}
