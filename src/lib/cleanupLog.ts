/**
 * Las pasadas de limpieza del almacén, tal y como las cuentan la pantalla, su
 * constancia y el aviso que las antecede. El taller retira archivos en dos
 * pasadas —lo que dejó a medias el formulario público y lo que ya no cita
 * ninguna ficha— y una tercera, la papelera, que borra de verdad lo que ya
 * cumplió su plazo. Cada una tiene su fila en `storageCleanupRuns`: aquí viven la
 * clave de cada una y la forma de escribir lo que se llevó, para que las tarjetas
 * de Ajustes del taller no tengan la suya.
 */

import { formatFileSize } from "./workshop";

/** Las pasadas que retiran archivos: lo que se llevan va a la papelera. */
export type RemovalPass = "reportUploads" | "orphanFiles";

/** Qué pasada de limpieza es. Son las claves que se guardan en su constancia. */
export type CleanupPass = RemovalPass | "trash";

/** Las dos pasadas que retiran archivos (la tercera los borra del todo). */
export const REMOVAL_PASSES: RemovalPass[] = ["reportUploads", "orphanFiles"];

/** Las tres pasadas, en el orden en que corren de madrugada. */
export const CLEANUP_PASSES: CleanupPass[] = [...REMOVAL_PASSES, "trash"];

/** Quién firma una pasada cuando no la ha lanzado nadie a mano. */
export const AUTO_CLEANUP_BY = "Limpieza automática";

/**
 * Cómo se llama cada pasada en pantalla, y cómo se cuenta lo que retiró (el
 * plural no se puede componer añadiendo una ese: «imagen» hace «imágenes»).
 */
export const CLEANUP_PASS_META: Record<
  CleanupPass,
  { label: string; one: string; many: string }
> = {
  reportUploads: {
    label: "Imágenes del formulario público",
    one: "imagen",
    many: "imágenes",
  },
  orphanFiles: {
    label: "Archivos sin citar",
    one: "archivo",
    many: "archivos",
  },
  trash: {
    label: "Borrado definitivo de la papelera",
    one: "archivo",
    many: "archivos",
  },
};

/** «2 imágenes», «1 archivo»: lo que retiró una pasada, ya escrito. */
export function cleanupCount(pass: CleanupPass, count: number): string {
  const meta = CLEANUP_PASS_META[pass];
  return `${count} ${count === 1 ? meta.one : meta.many}`;
}

/** «1 vale sin archivo» / «3 vales sin archivo»: lo que se va con las imágenes. */
export function cleanupTicketsLabel(count: number): string {
  return `${count} ${count === 1 ? "vale" : "vales"} sin archivo`;
}

/* ------------------------------------------------------------------ */
/* Aviso de lo que la limpieza se va a llevar del formulario público   */
/* ------------------------------------------------------------------ */

/**
 * El aviso que antecede a la pasada del formulario público: lo que la limpieza
 * de esta noche se va a llevar —las fotos que alguien subió y ninguna incidencia
 * cita; el aviso que se quedó a medias—, o null si no hay nada que barrer (un
 * aviso que no cuenta nada no se manda).
 *
 * Lleva la cuenta de lo que hay pendiente —cuántas fotos, cuánto ocupan y qué
 * vales sin archivo se van con ellas—, que es lo que se quiere saber de un
 * vistazo: la lista con cada foto está en Ajustes del taller, y a un aviso de la
 * campana no le cabe ni le toca repetirla.
 *
 * Lo que se retire no se pierde en el acto: la papelera del almacén lo guarda
 * unos días, así que se dice, que es la diferencia entre un aviso y un susto.
 * Cuando la pasada va por tandas también se dice: no es lo mismo «esto es todo»
 * que «esto es lo de esta noche».
 */
export function uploadSweepAlert(input: {
  /** Fotos que la pasada se llevará. */
  images: number;
  /** Vales sin archivo que se van con ellas: no son fotos, pero se van igual. */
  tickets: number;
  /** Lo que ocupan esas fotos, en bytes. */
  bytes: number;
  /** La pasada se llena con su tanda y quedan más detrás. */
  partial: boolean;
  /** El plazo vigente de la papelera, en días (lo ajusta el taller). */
  retentionDays: number;
}): string | null {
  if (input.images === 0 && input.tickets === 0) return null;

  const size = formatFileSize(input.bytes);
  const pending = [
    input.images > 0
      ? `${cleanupCount("reportUploads", input.images)} sin usar (${size})`
      : null,
    input.tickets > 0 ? cleanupTicketsLabel(input.tickets) : null,
  ].filter((part): part is string => part !== null);

  const sentences = [
    `La limpieza de esta noche se lleva del formulario público ${pending.join(
      " y ",
    )}.`,
    // Solo las fotos tienen archivo: un vale sin archivo no deja nada en la
    // papelera, así que el plazo se cuenta cuando hay fotos.
    input.images > 0
      ? `Lo retirado queda ${input.retentionDays} días en la papelera, por si hay que recuperarlo.`
      : null,
    input.partial
      ? "La limpieza va por tandas: quedan más para la noche siguiente."
      : null,
    "Lo puedes revisar en Ajustes del taller.",
  ];
  return sentences
    .filter((sentence): sentence is string => sentence !== null)
    .join(" ");
}
