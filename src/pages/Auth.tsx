import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { AuthHeader } from "./auth/components/AuthHeader";
import { PasswordAuthForm } from "./auth/components/PasswordAuthForm";
import { OtpEmailForm } from "./auth/components/OtpEmailForm";
import { useAuthState } from "./auth/hooks/useAuthState";
import type { AuthProps } from "./auth/types";

function Auth(props: AuthProps = {}) {
  const state = useAuthState(props);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex items-center justify-center h-full flex-col w-full">
          <Card className="w-full max-w-[380px] pb-0 border shadow-md">
            <AuthHeader
              method={state.method}
              onMethodChange={state.switchMethod}
              onLogoClick={() => state.navigate("/")}
            />

            {state.method === "password" ? (
              <PasswordAuthForm
                passwordFlow={state.passwordFlow}
                onPasswordFlowChange={(flow) => {
                  state.setPasswordFlow(flow);
                  state.setError(null);
                }}
                email={state.email}
                onEmailChange={state.setEmail}
                password={state.password}
                onPasswordChange={state.setPassword}
                error={state.error}
                isLoading={state.isLoading}
                onSubmit={state.handlePasswordSubmit}
              />
            ) : (
              <OtpEmailForm
                step={state.step}
                otp={state.otp}
                onOtpChange={state.setOtp}
                error={state.error}
                isLoading={state.isLoading}
                onEmailSubmit={state.handleEmailSubmit}
                onOtpSubmit={state.handleOtpSubmit}
                onResetToEmail={state.resetToEmail}
              />
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
