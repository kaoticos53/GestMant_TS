/**
 * Cifrado autenticado en reposo (AES-256-GCM) para secretos persistidos en
 * base de datos (claves de proveedores de correo en `mailSettings`).
 *
 * Usa exclusivamente la API estándar Web Crypto (`crypto.subtle`), disponible
 * tanto en el runtime V8 de Convex como en Node/Vitest, sin dependencias npm.
 */

const PREFIX = "enc:v1:";
const IV_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encryptionKeyMaterial(): string | null {
  const dedicated = (process.env.PULSO_SETTINGS_ENCRYPTION_KEY ?? "").trim();
  if (dedicated !== "") return dedicated;
  const jwt = (process.env.JWT_PRIVATE_KEY ?? "").trim();
  return jwt !== "" ? jwt : null;
}

async function deriveAesKey(material: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Pista visual segura (últimos 4 caracteres) calculada antes de cifrar. */
export function secretHint(plaintext: string): string {
  const trimmed = plaintext.trim();
  return trimmed === "" ? "" : `…${trimmed.slice(-4)}`;
}

/** ¿Está cifrado el valor con el formato `enc:v1:`? */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Cifra un secreto si hay material de clave configurado en el entorno del
 * deployment. Si no hay clave configurada (p. ej. desarrollo local mínimo sin
 * variables de entorno), devuelve el valor tal cual para no romper entornos
 * efímeros; en producción NAS (`funciones-lib.sh`) se genera automáticamente.
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const trimmed = plaintext.trim();
  if (trimmed === "") return "";
  if (isEncryptedSecret(trimmed)) return trimmed;

  const material = encryptionKeyMaterial();
  if (material === null) return trimmed;

  const key = await deriveAesKey(material);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(trimmed);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

/**
 * Descifra un secreto cifrado con `encryptSecret`. Acepta secretos heredados
 * en texto plano (sin prefijo `enc:v1:`) para compatibilidad hacia atrás.
 */
export async function decryptSecret(stored: string): Promise<string> {
  const trimmed = stored.trim();
  if (trimmed === "" || !isEncryptedSecret(trimmed)) return trimmed;

  const material = encryptionKeyMaterial();
  if (material === null) {
    throw new Error(
      "Falta PULSO_SETTINGS_ENCRYPTION_KEY para descifrar las credenciales de correo guardadas.",
    );
  }

  const body = trimmed.slice(PREFIX.length);
  const colon = body.indexOf(":");
  if (colon <= 0) {
    throw new Error("Formato de secreto cifrado inválido.");
  }
  const iv = fromBase64(body.slice(0, colon));
  const cipher = fromBase64(body.slice(colon + 1));
  const key = await deriveAesKey(material);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
    },
    key,
    new Uint8Array(cipher),
  );
  return new TextDecoder().decode(decrypted);
}

