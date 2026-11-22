/**
 * Envoltorio de una copia de seguridad: comprime el JSON, lo cifra con una
 * frase de paso y firma el conjunto. Sin React ni Convex: solo WebCrypto y las
 * APIs de compresión del navegador (y de Node, donde corren las pruebas).
 *
 * El archivo descargado ya no es el JSON legible del taller. La frase no se
 * guarda en ningún sitio: si se pierde, la copia no se puede abrir.
 */

export const BACKUP_FILE_FORMAT = "pulso-taller-backup-file" as const;
export const BACKUP_FILE_VERSION = 2 as const;

/** Longitud mínima de la frase; la interfaz usa la misma constante. */
export const MIN_BACKUP_PASSPHRASE = 10;

/** Coste del PBKDF2. Se acepta un rango al leer para permitir subirlo después. */
const KDF_ITERATIONS = 210_000;
const MIN_KDF_ITERATIONS = 100_000;
const MAX_KDF_ITERATIONS = 1_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const SIGNING_DOMAIN = "pulso-taller-backup-file:v2:";

interface ProtectedBackupEnvelope {
  format: typeof BACKUP_FILE_FORMAT;
  version: typeof BACKUP_FILE_VERSION;
  protection: "AES-GCM-256+HMAC-SHA256";
  compression: "gzip";
  kdf: {
    name: "PBKDF2-SHA256";
    iterations: number;
    salt: string;
  };
  iv: string;
  payload: string;
  signature: string;
}

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function gzip(value: string): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("Este navegador no puede comprimir la copia.");
  }
  const stream = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador no puede descomprimir la copia.");
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function deriveKeys(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ aes: CryptoKey; hmac: CryptoKey }> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      material,
      512,
    ),
  );
  const aes = await crypto.subtle.importKey(
    "raw",
    bits.slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  const hmac = await crypto.subtle.importKey(
    "raw",
    bits.slice(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return { aes, hmac };
}

function signedBytes(
  salt: Uint8Array,
  iv: Uint8Array,
  payload: Uint8Array,
): Uint8Array {
  const domain = encoder.encode(SIGNING_DOMAIN);
  const input = new Uint8Array(
    domain.length + salt.length + iv.length + payload.length,
  );
  input.set(domain, 0);
  input.set(salt, domain.length);
  input.set(iv, domain.length + salt.length);
  input.set(payload, domain.length + salt.length + iv.length);
  return input;
}

function readEnvelope(rawText: string): ProtectedBackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("El archivo de copia no contiene un JSON válido.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as { format?: unknown }).format !== BACKUP_FILE_FORMAT
  ) {
    throw new Error("El archivo no es una copia protegida de Pulso Taller.");
  }
  const envelope = parsed as Partial<ProtectedBackupEnvelope>;
  if (envelope.version !== BACKUP_FILE_VERSION) {
    throw new Error(
      `Versión de copia protegida no soportada (${String(envelope.version)}).`,
    );
  }
  const kdf = envelope.kdf;
  const iterations = kdf?.iterations;
  if (
    !kdf ||
    kdf.name !== "PBKDF2-SHA256" ||
    typeof iterations !== "number" ||
    !Number.isInteger(iterations) ||
    iterations < MIN_KDF_ITERATIONS ||
    iterations > MAX_KDF_ITERATIONS ||
    typeof kdf.salt !== "string"
  ) {
    throw new Error("La cabecera de la copia protegida no es válida.");
  }
  if (
    envelope.protection !== "AES-GCM-256+HMAC-SHA256" ||
    envelope.compression !== "gzip" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.payload !== "string" ||
    typeof envelope.signature !== "string"
  ) {
    throw new Error("La cabecera de la copia protegida no es válida.");
  }
  try {
    if (
      base64ToBytes(kdf.salt).length !== SALT_BYTES ||
      base64ToBytes(envelope.iv).length !== IV_BYTES
    ) {
      throw new Error("longitud inesperada");
    }
  } catch {
    throw new Error("La cabecera de la copia protegida no es válida.");
  }
  return envelope as ProtectedBackupEnvelope;
}

/** ¿El archivo es un envoltorio protegido, en vez del JSON de una copia v1? */
export function isProtectedBackup(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText) as { format?: unknown } | null;
    return parsed?.format === BACKUP_FILE_FORMAT;
  } catch {
    return false;
  }
}

/**
 * Comprime, cifra y firma un JSON de copia. La firma usa una clave derivada de
 * la misma frase que el cifrado y cubre sal, IV y criptograma: un archivo
 * cambiado o una frase distinta fallan antes de descifrar.
 */
export async function protectBackup(
  rawJson: string,
  passphrase: string,
): Promise<string> {
  if (passphrase.length < MIN_BACKUP_PASSPHRASE) {
    throw new Error(
      `La frase de la copia debe tener al menos ${MIN_BACKUP_PASSPHRASE} caracteres.`,
    );
  }
  const compressed = await gzip(rawJson);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const { aes, hmac } = await deriveKeys(passphrase, salt, KDF_ITERATIONS);
  const payload = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, compressed),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmac, signedBytes(salt, iv, payload)),
  );
  const envelope: ProtectedBackupEnvelope = {
    format: BACKUP_FILE_FORMAT,
    version: BACKUP_FILE_VERSION,
    protection: "AES-GCM-256+HMAC-SHA256",
    compression: "gzip",
    kdf: {
      name: "PBKDF2-SHA256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    iv: bytesToBase64(iv),
    payload: bytesToBase64(payload),
    signature: bytesToBase64(signature),
  };
  return JSON.stringify(envelope);
}

/**
 * Verifica la firma, descifra y descomprime. No interpreta el JSON: de eso se
 * encarga `parseWorkshopBackup`, que además comprueba versión y manifiesto.
 */
export async function unlockBackup(
  rawText: string,
  passphrase: string,
): Promise<string> {
  const envelope = readEnvelope(rawText);
  if (passphrase.length < MIN_BACKUP_PASSPHRASE) {
    throw new Error(
      "La frase no es correcta o el archivo está dañado. No se ha abierto la copia.",
    );
  }
  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.iv);
  const payload = base64ToBytes(envelope.payload);
  const signature = base64ToBytes(envelope.signature);
  const { aes, hmac } = await deriveKeys(
    passphrase,
    salt,
    envelope.kdf.iterations,
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    hmac,
    signature,
    signedBytes(salt, iv, payload),
  );
  if (!valid) {
    throw new Error(
      "La frase no es correcta o el archivo está dañado. No se ha abierto la copia.",
    );
  }
  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, payload),
    );
  } catch {
    throw new Error(
      "La frase no es correcta o el archivo está dañado. No se ha abierto la copia.",
    );
  }
  return await gunzip(compressed);
}
