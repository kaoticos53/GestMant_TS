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

/**
 * «1 archivo que el almacén no puede leer» / «3 archivos que el almacén no puede
 * leer»: lo que la limpieza se encuentra y no puede juzgar.
 *
 * Un archivo que no se lee es uno al que el almacén no llega: o está en su lista y
 * no da dirección con la que abrirlo, o algo lo cita y ya no está. En los dos
 * casos no se puede decir si alguien lo usa, así que la limpieza no lo retira: lo
 * cuenta aparte y lo señala, que es lo único honesto que se puede hacer con él.
 */
export function cleanupUnreadableLabel(count: number): string {
  return `${count} ${
    count === 1
      ? "archivo que el almacén no puede leer"
      : "archivos que el almacén no puede leer"
  }`;
}

/**
 * Lo que la limpieza puede decidir de un archivo del almacén:
 *
 *   - `unreadable`: no hay dirección que leer. De un archivo que no se lee no se
 *     puede decidir nada —tampoco que no lo cite nadie—, así que se queda donde
 *     está y se señala.
 *   - `cited`: algo de lo guardado lo menciona. Se queda.
 *   - `orphan`: se lee y no lo menciona nadie. Es lo único que se retira.
 *
 * La decisión vive aquí, fuera de la pasada, porque es la regla que no puede
 * equivocarse: dar por «sin citar» un archivo que no se ha podido leer es la
 * forma de borrar algo en uso.
 */
export type FileReading = "unreadable" | "cited" | "orphan";

export function fileReading(input: {
  /** La dirección con la que el almacén sirve el archivo; `null` si no da ninguna. */
  address: string | null;
  /** ¿Lo menciona algo de lo que hay guardado? */
  cited: boolean;
}): FileReading {
  if (!input.address) return "unreadable";
  return input.cited ? "cited" : "orphan";
}

/* ------------------------------------------------------------------ */
/* Aviso de lo que la limpieza se va a llevar del formulario público   */
/* ------------------------------------------------------------------ */

/**
 * Lo pendiente, en una lista que se lee: «A», «A y B», «A, B y C». Con tres
 * cosas distintas que contar —fotos, vales sin archivo y lo que no se puede
 * leer—, unirlas todas con «y» no se lee.
 */
function joinPending(parts: string[]): string {
  const last = parts[parts.length - 1] ?? "";
  if (parts.length <= 1) return last;
  return `${parts.slice(0, -1).join(", ")} y ${last}`;
}

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
  /**
   * Vales cuyo archivo el almacén ya no puede leer: se van con ellas, pero no hay
   * nada que guardar en la papelera ni tamaño que contar. Se dicen aparte, porque
   * una imagen de 0 KB no es una imagen.
   */
  unreadable: number;
  /** Lo que ocupan esas fotos, en bytes. */
  bytes: number;
  /** La pasada se llena con su tanda y quedan más detrás. */
  partial: boolean;
  /** El plazo vigente de la papelera, en días (lo ajusta el taller). */
  retentionDays: number;
}): string | null {
  if (input.images === 0 && input.tickets === 0 && input.unreadable === 0) {
    return null;
  }

  const size = formatFileSize(input.bytes);
  const pending = [
    input.images > 0
      ? `${cleanupCount("reportUploads", input.images)} sin usar (${size})`
      : null,
    input.tickets > 0 ? cleanupTicketsLabel(input.tickets) : null,
    input.unreadable > 0 ? cleanupUnreadableLabel(input.unreadable) : null,
  ].filter((part): part is string => part !== null);

  const sentences = [
    `La limpieza de esta noche se lleva del formulario público ${joinPending(
      pending,
    )}.`,
    // Solo las fotos tienen archivo: un vale sin archivo no deja nada en la
    // papelera, así que el plazo se cuenta cuando hay fotos.
    input.images > 0
      ? `Lo retirado queda ${input.retentionDays} días en la papelera, por si hay que recuperarlo.`
      : null,
    // Y lo que no se puede leer no deja nada: no hay archivo que guardar. Decirlo
    // es la diferencia entre «se ha ido» y «no había nada que se pudiera ir».
    input.unreadable > 0
      ? "De lo que el almacén no puede leer no queda nada en la papelera: no hay archivo que guardar."
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

/* ------------------------------------------------------------------ */
/* Aviso de los archivos que la limpieza no puede leer                 */
/* ------------------------------------------------------------------ */

/**
 * El aviso de los archivos que la limpieza del almacén se ha encontrado y no
 * puede leer: los que están en la lista del almacén sin dirección con la que
 * abrirlos y los que algo cita y ya no están.
 *
 * No se retiran —de un archivo que no se lee no se puede decidir nada, ni que no
 * lo cite nadie—, así que el aviso no cuenta algo que se va: cuenta algo que se
 * queda y que hay que mirar. Sale también cuando la cuenta baja —un archivo que
 * vuelve a leerse deja de ser un problema— porque eso es una novedad igual.
 *
 * Con una cuenta que no cambia no avisa: lo que sigue sin poder leerse ya se dijo
 * la noche que apareció, y repetirlo cada madrugada sería ruido. Devuelve `null`
 * cuando no hay nada que contar o nada nuevo que contar.
 */
export function unreadableFilesAlert(input: {
  /** Archivos que la limpieza no ha podido leer en esta pasada. */
  unreadable: number;
  /** Los que apuntó la pasada anterior: la cuenta que se dijo entonces. */
  before: number;
}): string | null {
  if (input.unreadable === 0) return null;
  if (input.unreadable === input.before) return null;

  return [
    `La limpieza del almacén ha encontrado ${cleanupUnreadableLabel(
      input.unreadable,
    )}.`,
    "Se quedan donde estaban: de un archivo que no se lee no se decide nada.",
    input.before === 0
      ? "La pasada anterior no encontró ninguno."
      : `Antes eran ${input.before}.`,
    "Lo puedes revisar en Ajustes del taller.",
  ].join(" ");
}
