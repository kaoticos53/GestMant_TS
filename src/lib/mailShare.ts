/**
 * Las reglas de las copias de correo compartidas (SPEC-0018), como código puro.
 *
 * Una copia no es caché: no entra en `mailAccounts.cacheBytes`, no la expulsa el
 * LRU, no la borra «Vaciar caché» y sobrevive a la desconexión de la cuenta. Su
 * visibilidad es la del registro destino y su retención, la del destino también.
 *
 * Aquí vive lo que se puede decidir sin base de datos ni React: qué modo admite
 * cada destino, cuánto ocupa el snapshot, cómo se construye el resumen y quién
 * ve la copia según las capacidades que tenga. El backend de `mailShares`
 * resuelve la ficha concreta y llama a estas funciones.
 */

import type { Capability } from "./permissions";

/** Los registros del taller con los que se puede compartir un correo. */
export type MailShareDestinationType =
  | "incident"
  | "request"
  | "equipment"
  | "manual"
  | "purchaseOrder"
  | "purchaseRequest";

/** `summary` guarda metadatos y extracto; `original`, cuerpo y adjuntos. */
export type MailShareMode = "summary" | "original";

export const MAIL_SHARE_MODES: readonly MailShareMode[] = [
  "summary",
  "original",
] as const;

export const DESTINATION_TYPES: readonly MailShareDestinationType[] = [
  "incident",
  "request",
  "equipment",
  "manual",
  "purchaseOrder",
  "purchaseRequest",
] as const;

/** Cómo se llama cada destino en el diálogo y en la sección de la ficha. */
export const DESTINATION_LABELS: Record<MailShareDestinationType, string> = {
  incident: "Incidencia",
  request: "Petición de repuesto",
  equipment: "Equipo",
  manual: "Manual",
  purchaseOrder: "Orden de compra",
  purchaseRequest: "Petición de compra",
};

/** Extracto en texto plano que se guarda con una copia `summary`. */
export const SUMMARY_MAX_CHARS = 8 * 1024;
/** Texto plano máximo del snapshot `original`. */
export const BODY_TEXT_MAX_CHARS = 64 * 1024;
/** HTML saneado máximo del snapshot `original`. */
export const BODY_HTML_MAX_CHARS = 512 * 1024;
/** Límite por copia, el mismo que el mensaje descargado de 0017. */
export const MAX_SHARE_BYTES = 50 * 1024 * 1024;
/** Plazo fijo de la papelera administrativa de copias huérfanas. */
export const ORPHAN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Capacidad que exige compartir con cada destino (SPEC-0018 §5.2). Incidencias,
 * peticiones, equipos, manuales y compras no se tocan desde el buzón: solo se
 * adjunta una copia, y para eso hace falta la capacidad que ya gobierna el
 * destino. El administrador la tiene siempre; no hay capacidad `viewMailShares`.
 */
export const SHARE_CAPABILITY: Record<MailShareDestinationType, Capability> =
  {
    incident: "manageIncidents",
    request: "decideRequests",
    equipment: "manageEquipment",
    manual: "manageManuals",
    purchaseOrder: "managePurchasing",
    purchaseRequest: "managePurchasing",
  };

/**
 * Capacidades con las que se ve la copia. Lista vacía significa «cualquier
 * miembro activo del taller», que es la audiencia de incidencias y peticiones:
 * la misma que la de su ficha, no la de su menú.
 */
export const DESTINATION_AUDIENCE: Record<
  MailShareDestinationType,
  readonly Capability[]
> = {
  incident: [],
  request: [],
  equipment: ["viewEquipment", "manageEquipment"],
  manual: ["viewManuals", "manageManuals"],
  purchaseOrder: ["viewPurchasing", "managePurchasing"],
  purchaseRequest: ["viewPurchasing", "managePurchasing"],
};

/** Los manuales ya tienen su PDF: el correo solo aporta contexto. */
export function allowsOriginal(type: MailShareDestinationType): boolean {
  return type !== "manual";
}

/**
 * El modo con el que se guarda la copia. Pedir `original` en un manual no se
 * degrada en silencio a `summary`: se rechaza, para que quien comparte sepa
 * que ese destino solo admite resumen.
 */
export function resolveShareMode(
  type: MailShareDestinationType,
  requested: MailShareMode,
): { ok: true; mode: MailShareMode } | { ok: false; error: string } {
  if (requested === "original" && !allowsOriginal(type)) {
    return {
      ok: false,
      error: `${DESTINATION_LABELS[type]} solo admite el resumen del correo: no guarda cuerpo, adjuntos ni el archivo original.`,
    };
  }
  return { ok: true, mode: requested };
}

/** Recorta sin partir un par sustituto (emojis y letras fuera del BMP). */
function sliceChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let end = maxChars;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

/** Texto recortado y si hubo recorte, para poder avisarlo en la copia. */
export function truncateShareText(
  text: string,
  maxChars: number,
): { value: string; truncated: boolean } {
  if (text.length <= maxChars) return { value: text, truncated: false };
  return { value: sliceChars(text, maxChars), truncated: true };
}

/**
 * Extracto de la copia: las primeras líneas del texto del mensaje, con los
 * espacios colapsados para que quepan varias frases en el resumen. Si el
 * mensaje no trae texto legible, se usa el asunto: una copia con resumen vacío
 * no diría de qué iba el correo.
 */
export function buildShareSummary(text: string, subject = ""): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const base = flat === "" ? subject.replace(/\s+/g, " ").trim() : flat;
  return truncateShareText(base, SUMMARY_MAX_CHARS).value;
}

/** Bytes que suma una copia `original`, incluido el `.eml` si se conserva. */
export interface ShareSnapshotSize {
  bodyText: number;
  bodyHtml: number;
  attachments: number;
  eml: number;
}

/** Tamaño total del snapshot, en bytes (los textos se cuentan en UTF-8). */
export function shareSnapshotBytes(size: ShareSnapshotSize): number {
  return size.bodyText + size.bodyHtml + size.attachments + size.eml;
}

/** ¿Cabe la copia en el límite de 50 MB por mensaje de 0017? */
export function fitsShareLimit(bytes: number): boolean {
  return bytes <= MAX_SHARE_BYTES;
}

/** Vencimiento de una copia huérfana: siete días fijos desde el borrado. */
export function orphanPurgeAt(destinationDeletedAt: number): number {
  return destinationDeletedAt + ORPHAN_RETENTION_MS;
}

/** Lo que hace falta saber para decidir si alguien ve una copia. */
export interface ShareAudienceInput {
  destinationType: MailShareDestinationType;
  /** La ficha del destino está en la papelera de su módulo. */
  destinationInTrash?: boolean;
  /** El administrador ve las copias vivas y la papelera administrativa. */
  isAdmin?: boolean;
  /** Cuenta dada de baja: no ve nada, aunque conserve sus copias. */
  active?: boolean;
  /** Sesión anónima (invitado): no ve nada. */
  isAnonymous?: boolean;
  grants?: Partial<Record<Capability, boolean>>;
}

/**
 * ¿Puede esta persona ver la copia? Se aplica la audiencia del destino, no una
 * capacidad nueva: en incidencias y peticiones basta con ser miembro activo,
 * porque así se ve también la ficha; el resto exige la capacidad de su módulo.
 * En la papelera de incidencias y peticiones solo entra la coordinación, que es
 * quien ve esa papelera. Ni el invitado ni la sesión anónima ven copias.
 */
export function canReadSharedMail(input: ShareAudienceInput): boolean {
  // Sin identidad establecida no se enseña nada: una sesión sin usuario no es
  // un miembro activo. Por eso se exige `active === true` y no solo «no baja».
  if (input.active !== true || input.isAnonymous === true) return false;
  if (input.isAdmin === true) return true;

  const grants = input.grants ?? {};
  const has = (capability: Capability) => grants[capability] === true;

  if (input.destinationType === "incident" || input.destinationType === "request") {
    // Quien ve la papelera de incidencias o de peticiones ve también sus copias.
    if (input.destinationInTrash === true) {
      return has("manageIncidents") || has("decideRequests");
    }
    return true;
  }

  return DESTINATION_AUDIENCE[input.destinationType].some(has);
}
