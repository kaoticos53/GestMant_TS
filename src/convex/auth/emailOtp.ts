import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/** Tiempo máximo de espera al gateway de envío de códigos. */
const EMAIL_OTP_TIMEOUT_MS = 10_000;

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 5, // 5 minutos (NIST SP 800-63B / OWASP)
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    let response: Response;
    try {
      response = await fetch(freebuffEmailOtpUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...freebuffEmailOtpHeaders(),
        },
        body: JSON.stringify({ to: email, otp: token }),
        signal: AbortSignal.timeout(EMAIL_OTP_TIMEOUT_MS),
      });
    } catch (error) {
      throw freebuffEmailOtpError(error);
    }
    if (!response.ok) {
      throw await freebuffEmailOtpHttpError(response);
    }
  },
});

// Sign-in codes are sent by the Freebuff integrations gateway, which knows
// this project by its own key: VLY_INTEGRATION_KEY, a Convex environment
// variable set when the project was created. The email's wording is fixed by
// the gateway.
function freebuffEmailOtpUrl(): string {
  const base =
    process.env.VLY_INTEGRATION_BASE_URL || "https://integrations.vly.ai";
  return `${base.replace(/\/+$/, "")}/v1/email/otp`;
}

function freebuffEmailOtpHeaders(): Record<string, string> {
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "VLY_INTEGRATION_KEY is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return { Authorization: `Bearer ${key}` };
}

// Never stringify the whole request error: it carries the request headers.
async function freebuffEmailOtpHttpError(response: Response): Promise<Error> {
  let detail = "";
  try {
    const body: unknown = await response.json();
    const reason = (body as { error?: unknown } | null)?.error;
    if (typeof reason === "string") detail = `: ${reason}`;
  } catch {
    // Cuerpo no JSON: se informa solo el código HTTP.
  }
  return new Error(
    `Could not send the sign-in code (HTTP ${response.status})${detail}`,
  );
}

function freebuffEmailOtpError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not send the sign-in code: ${message}`);
}
