export interface AuthProps {
  redirectAfterAuth?: string;
}

export type AuthMethod = "password" | "email";
export type PasswordFlow = "signIn" | "signUp";
export type OtpStep = "signIn" | { email: string };
