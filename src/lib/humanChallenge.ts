/**
 * Reglas puras del reto anti-bot invisible para puertas públicas:
 * - Modo Turnstile (Cloudflare `siteverify` en el adaptador de Convex).
 * - Modo Proof-of-Work criptográfico propio (SHA-256 + firma HMAC-SHA256 +
 *   Time-Trap), sin dependencias externas ni salida a Internet.
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Dificultad por defecto del Proof-of-Work (16 bits ≈ 65.536 hashes de media). */
export const POW_DEFAULT_BITS = 16;

/** Tiempo mínimo entre la emisión del reto y su envío (Time-Trap anti-script). */
export const POW_MIN_DELAY_MS = 1_500;

/** Ventana de validez de un reto firmado (15 minutos). */
export const POW_TTL_MS = 15 * 60 * 1000;

export type HumanChallengePayload =
  | { kind: "turnstile"; token: string }
  | {
      kind: "pow";
      salt: string;
      issuedAt: number;
      expiresAt: number;
      bits: number;
      signature: string;
      nonce: number;
    };

export interface SignedPowChallenge {
  salt: string;
  issuedAt: number;
  expiresAt: number;
  bits: number;
  signature: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Comprueba si los primeros `bits` del digest SHA-256 son cero. */
export function hasLeadingZeroBits(bytes: Uint8Array, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;
  if (bytes.length < fullBytes + (remainingBits > 0 ? 1 : 0)) return false;
  for (let i = 0; i < fullBytes; i += 1) {
    if (bytes[i] !== 0) return false;
  }
  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((bytes[fullBytes]! & mask) !== 0) return false;
  }
  return true;
}

export function powChallengeMessage(
  salt: string,
  issuedAt: number,
  expiresAt: number,
  bits: number,
): string {
  return `${salt}|${issuedAt}|${expiresAt}|${bits}`;
}

export function powInputString(salt: string, nonce: number): string {
  return `${salt}:${nonce}`;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Firma los parámetros de un reto PoW con HMAC-SHA256. */
export async function signPowChallenge(
  secret: string,
  params: { salt: string; issuedAt: number; expiresAt: number; bits: number },
): Promise<string> {
  const key = await importHmacKey(secret);
  const msg = powChallengeMessage(
    params.salt,
    params.issuedAt,
    params.expiresAt,
    params.bits,
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(msg),
  );
  return toHex(new Uint8Array(sig));
}

/** Verifica en tiempo constante la firma HMAC del reto PoW. */
export async function verifyPowSignature(
  secret: string,
  params: { salt: string; issuedAt: number; expiresAt: number; bits: number },
  signature: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = await signPowChallenge(secret, params);
  return constantTimeEqual(expected, signature.toLowerCase());
}

/** Resuelve en el cliente un reto PoW buscando un `nonce` válido. */
export async function solvePowChallenge(
  salt: string,
  bits: number = POW_DEFAULT_BITS,
): Promise<number> {
  const encoder = new TextEncoder();
  for (let nonce = 0; ; nonce += 1) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(powInputString(salt, nonce)),
    );
    if (hasLeadingZeroBits(new Uint8Array(digest), bits)) {
      return nonce;
    }
  }
}

/** Valida firma, caducidad, Time-Trap y solución SHA-256 de un reto PoW. */
export async function verifyPowSolution(args: {
  secret: string;
  salt: string;
  issuedAt: number;
  expiresAt: number;
  bits: number;
  signature: string;
  nonce: number;
  now?: number;
  minDelayMs?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = args.now ?? Date.now();
  const minDelayMs = args.minDelayMs ?? POW_MIN_DELAY_MS;

  if (
    !Number.isSafeInteger(args.nonce) ||
    args.nonce < 0 ||
    !Number.isSafeInteger(args.bits) ||
    args.bits < 8 ||
    args.bits > 24
  ) {
    return {
      ok: false,
      error: "La verificación de seguridad no es válida. Vuelve a intentarlo.",
    };
  }

  if (now > args.expiresAt) {
    return {
      ok: false,
      error:
        "La verificación de seguridad ha caducado. Recarga o vuelve a enviar el formulario.",
    };
  }

  if (now - args.issuedAt < minDelayMs) {
    return {
      ok: false,
      error:
        "El envío ha sido demasiado rápido. Espera un segundo y vuelve a intentarlo.",
    };
  }

  const validSig = await verifyPowSignature(
    args.secret,
    {
      salt: args.salt,
      issuedAt: args.issuedAt,
      expiresAt: args.expiresAt,
      bits: args.bits,
    },
    args.signature,
  );
  if (!validSig) {
    return {
      ok: false,
      error: "La verificación de seguridad no coincide. Vuelve a intentarlo.",
    };
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(powInputString(args.salt, args.nonce)),
  );
  if (!hasLeadingZeroBits(new Uint8Array(digest), args.bits)) {
    return {
      ok: false,
      error:
        "No se ha podido validar la prueba de envío. Vuelve a intentarlo.",
    };
  }

  return { ok: true };
}

