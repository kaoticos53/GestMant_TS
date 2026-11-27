/**
 * Reglas puras y generación aleatoria segura para contraseñas del taller.
 * Vive fuera de React/Convex para ser reutilizado tanto en servidor como en UI.
 */

export const MIN_PASSWORD_LENGTH = 8;

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*-_";
const ALL_CHARS = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

/** Valida los requisitos mínimos de una contraseña y devuelve el mensaje de error si falla. */
export function validatePassword(password: string): string | null {
  if (!password || password.trim().length === 0) {
    return "Indica una contraseña.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

function randomIndex(max: number): number {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Genera una contraseña aleatoria legible (sin caracteres ambiguos) de al menos 12 caracteres. */
export function generateSecurePassword(length = 14): string {
  const targetLength = Math.max(12, Math.floor(length));
  const chars = [
    LOWER[randomIndex(LOWER.length)],
    UPPER[randomIndex(UPPER.length)],
    DIGITS[randomIndex(DIGITS.length)],
    SYMBOLS[randomIndex(SYMBOLS.length)],
  ];
  while (chars.length < targetLength) {
    chars.push(ALL_CHARS[randomIndex(ALL_CHARS.length)]);
  }
  // Fisher-Yates para evitar orden predecible de clases al inicio
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}
