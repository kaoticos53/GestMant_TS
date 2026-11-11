import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  POW_DEFAULT_BITS,
  POW_TTL_MS,
  TURNSTILE_VERIFY_URL,
  signPowChallenge,
  verifyPowSolution,
  type HumanChallengePayload,
} from "../lib/humanChallenge";
import { internal } from "./_generated/api";
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

const TURNSTILE_TIMEOUT_MS = 8_000;
const PURGE_LIMIT = 100;

export const humanChallengeValidator = v.union(
  v.object({
    kind: v.literal("turnstile"),
    token: v.string(),
  }),
  v.object({
    kind: v.literal("pow"),
    salt: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    bits: v.number(),
    signature: v.string(),
    nonce: v.number(),
  }),
);

function turnstileSecret(): string | null {
  const val = (process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  return val !== "" ? val : null;
}

function powSecret(): string | null {
  const dedicated = (process.env.PULSO_CHALLENGE_SECRET ?? "").trim();
  if (dedicated !== "") return dedicated;
  const jwt = (process.env.JWT_PRIVATE_KEY ?? "").trim();
  return jwt !== "" ? jwt : null;
}

function randomHex(bytesLen: number): string {
  const bytes = new Uint8Array(bytesLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Comprueba si quien llama tiene una sesión activa de miembro del taller. */
export const isActiveMember = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const user = await ctx.db.get(userId);
    return (
      user !== null &&
      user.active !== false &&
      user.isAnonymous !== true
    );
  },
});

/** Marca un reto o token como usado para impedir ataques de repetición (replay). */
export const consumeChallengeKey = internalMutation({
  args: { key: v.string(), expiresAt: v.number() },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("publicChallengeUsed")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing !== null) return false;

    await ctx.db.insert("publicChallengeUsed", {
      key: args.key,
      expiresAt: args.expiresAt,
    });
    return true;
  },
});

/** Purga nocturna de retos anti-replay ya caducados. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now();
    const rows = await ctx.db
      .query("publicChallengeUsed")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(PURGE_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});

/** Indica al cliente qué modo de verificación está activo en este despliegue. */
export const mode = query({
  args: {},
  handler: async (): Promise<{ mode: "turnstile" | "pow" | "none" }> => {
    if (turnstileSecret() !== null) return { mode: "turnstile" };
    if (powSecret() !== null) return { mode: "pow" };
    return { mode: "none" };
  },
});

/** Emite un reto Proof-of-Work firmado para envíos anónimos sin Turnstile. */
export const issuePow = action({
  args: {},
  handler: async () => {
    const secret = powSecret();
    if (secret === null) {
      return null;
    }
    const salt = randomHex(16);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + POW_TTL_MS;
    const bits = POW_DEFAULT_BITS;
    const signature = await signPowChallenge(secret, {
      salt,
      issuedAt,
      expiresAt,
      bits,
    });
    return { salt, issuedAt, expiresAt, bits, signature };
  },
});

/**
 * Verifica el reto anti-bot en el servidor antes de ejecutar mutaciones
 * públicas sensibles (`incidents.report` y `reportUploads.generateUploadUrl`).
 * Los miembros activos autenticados quedan exentos del reto.
 */
export async function verifyHumanChallenge(
  ctx: ActionCtx,
  challenge: HumanChallengePayload | undefined,
): Promise<{ authenticated: boolean }> {
  const authenticated = await ctx.runQuery(
    internal.humanChallenge.isActiveMember,
    {},
  );
  if (authenticated) {
    return { authenticated: true };
  }

  const cfSecret = turnstileSecret();
  if (cfSecret !== null) {
    if (
      !challenge ||
      challenge.kind !== "turnstile" ||
      challenge.token.trim() === "" ||
      challenge.token.length > 4096
    ) {
      throw new ConvexError(
        "Completa la verificación de seguridad antes de enviar el formulario.",
      );
    }

    const token = challenge.token.trim();
    const body = new URLSearchParams({
      secret: cfSecret,
      response: token,
    });

    let response: Response;
    try {
      response = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
    } catch {
      throw new ConvexError(
        "No se pudo validar la verificación de seguridad. Inténtalo de nuevo.",
      );
    }

    if (!response.ok) {
      throw new ConvexError(
        "El servicio de verificación de seguridad no respondió correctamente. Inténtalo de nuevo.",
      );
    }

    const data = (await response.json()) as { success?: boolean };
    if (data.success !== true) {
      throw new ConvexError(
        "La verificación de seguridad ha fallado o caducado. Recarga el formulario e inténtalo de nuevo.",
      );
    }

    const tokenHash = await sha256Hex(token);
    const fresh = await ctx.runMutation(
      internal.humanChallenge.consumeChallengeKey,
      {
        key: `ts:${tokenHash}`,
        expiresAt: Date.now() + 10 * 60 * 1000,
      },
    );
    if (!fresh) {
      throw new ConvexError(
        "La verificación de seguridad ya se había utilizado. Vuelve a intentarlo.",
      );
    }
    return { authenticated: false };
  }

  const secret = powSecret();
  if (secret !== null) {
    if (!challenge || challenge.kind !== "pow") {
      throw new ConvexError(
        "Falta la verificación automática de envío. Vuelve a intentarlo.",
      );
    }

    const verdict = await verifyPowSolution({
      secret,
      salt: challenge.salt,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      bits: challenge.bits,
      signature: challenge.signature,
      nonce: challenge.nonce,
    });
    if (!verdict.ok) {
      throw new ConvexError(verdict.error);
    }

    const fresh = await ctx.runMutation(
      internal.humanChallenge.consumeChallengeKey,
      {
        key: `pow:${challenge.salt}`,
        expiresAt: challenge.expiresAt,
      },
    );
    if (!fresh) {
      throw new ConvexError(
        "La prueba de envío ya se había utilizado. Vuelve a intentarlo.",
      );
    }
    return { authenticated: false };
  }

  // Entornos efímeros sin claves de deployment (p. ej. suites de prueba sin
  // secretos configurados): no se bloquea salvo que falte el propio flujo de test.
  return { authenticated: false };
}

