import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import type { OtpStep } from "../types";

export function OtpEmailForm({
  step,
  otp,
  onOtpChange,
  error,
  isLoading,
  onEmailSubmit,
  onOtpSubmit,
  onResetToEmail,
}: {
  step: OtpStep;
  otp: string;
  onOtpChange: (value: string) => void;
  error: string | null;
  isLoading: boolean;
  onEmailSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onOtpSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onResetToEmail: () => void;
}) {
  if (step === "signIn") {
    return (
      <form onSubmit={onEmailSubmit}>
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
    );
  }

  return (
    <form onSubmit={onOtpSubmit}>
      <CardContent className="grid gap-3 pb-4">
        <input type="hidden" name="email" value={step.email} />
        <input type="hidden" name="code" value={otp} />

        <div className="flex justify-center">
          <InputOTP
            value={otp}
            onChange={onOtpChange}
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
            type="button"
            variant="link"
            className="p-0 h-auto"
            onClick={onResetToEmail}
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
          onClick={onResetToEmail}
          disabled={isLoading}
          className="w-full"
        >
          Usar otro correo
        </Button>
      </CardContent>
    </form>
  );
}
