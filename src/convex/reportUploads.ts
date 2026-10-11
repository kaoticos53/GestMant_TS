import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { AUTO_CLEANUP_BY, uploadSweepAlert } from "../lib/cleanupLog";
import { coordinatorIds, requireCoordinator } from "./permissions";
import { cleanupActor, recordCleanupRun } from "./cleanupLog";
import { notifyUsers } from "./notify";
import { moveToTrash, trashRetentionDays } from "./trash";
import { richDocBlocks, type RichBlock } from "../lib/richDoc";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  MAX_REPORT_IMAGES,
} from "../lib/upload";

/**
 * Imágenes del formulario público de incidencia. Quien notifica una avería no
 * tiene cuenta, así que no puede subir por `uploads.ts` —que pide sesión—: pasa
 * por su propio vale.
 *
 * El formulario pide una dirección de subida (`generateUploadUrl`), sube el
 * archivo y lo acredita con ese vale (`attachImage`). Hasta que no lo acredita
 * el archivo no vale para nada: `incidents.report` solo acepta las imágenes que
 * constan aquí, así que lo que se cuele por otro camino se queda fuera de la
 * incidencia. Y lo que nadie acredita —o nadie llega a citar en una incidencia—
 * lo retira la limpieza nocturna, que lo deja en la papelera unos días antes de
 * borrarlo: así un formulario abierto a cualquiera no se convierte en un
 * vertedero de archivos, y un purgado por error todavía se puede recuperar.
 *
 * La comprobación del archivo la hace una acción, porque es la única pieza que
 * puede leer los bytes del archivo; el vale y la base de datos los lleva la
 * mutación interna. Lo que decide no es lo que diga el navegador —eso lo puede
 * decir cualquiera— sino lo que hay dentro del archivo.
 */

const H = 60 * 60 * 1000;

/**
 * Cuántas subidas puede pedir el formulario público en una hora. Es el único
 * freno de una puerta sin cuenta: la dirección de subida que da Convex sirve
 * para varias subidas mientras no caduque, así que un archivo que llega con un
 * vale que nadie acredita no aparece en ninguna parte y no hay forma de
 * encontrarlo. Pidiendo poco, poco se puede meter.
 */
export const MAX_UPLOADS_PER_HOUR = 30;

/** Cuánto se guarda lo que ninguna incidencia cita antes de barrerlo. */
const UNUSED_RETENTION_MS = 24 * H;

/** Tope de una pasada de limpieza: no barre la tabla entera de golpe. */
const SWEEP_LIMIT = 100;

/**
 * Qué puede fallar al mirar un archivo. Lo decide la acción —que es la que ve
 * sus bytes— y lo resuelve la mutación interna, que es la que tiene la base de
 * datos delante.
 */
const uploadProblemValidator = v.union(
  v.literal("notAnImage"),
  v.literal("tooBig"),
);

/** Por qué no se ha aceptado un archivo. El texto que lee quien lo sube va aparte. */
type Rejection =
  | "unknownTicket"
  | "missingFile"
  | "notAnImage"
  | "tooBig"
  | "foreignFile"
  | "ticketUsed"
  | "alreadyAttached";

/**
 * Lo que devuelve la acreditación: la dirección con la que enlazar la imagen, o
 * el motivo por el que no se acepta. Devuelve en vez de lanzar porque dentro de
 * la misma mutación puede haber que retirar un archivo, y una mutación que
 * lanza deshace todo lo que había escrito: el archivo retirado volvería a su
 * sitio. Quien lanza el aviso que ve el usuario es la acción, después.
 */
type ClaimResult =
  | { ok: true; url: string | null }
  | { ok: false; reason: Rejection };

/** El aviso que ve quien sube el archivo, por cada motivo de rechazo. */
const REJECTION_MESSAGES: Record<Rejection, string> = {
  unknownTicket:
    "No se ha podido comprobar la imagen: vuelve a elegirla y envíala de nuevo.",
  missingFile: "La imagen no ha llegado al servidor: vuelve a adjuntarla.",
  notAnImage:
    "Solo se pueden adjuntar fotos (JPEG, PNG, HEIC, AVIF, WEBP o GIF).",
  tooBig: `Cada imagen puede pesar como mucho ${MAX_FILE_SIZE_LABEL}.`,
  foreignFile:
    "Ese archivo no lo ha subido este formulario: vuelve a elegir la imagen que quieres adjuntar.",
  ticketUsed:
    "Ese vale ya tenía su imagen: vuelve a elegir la que quieres adjuntar.",
  alreadyAttached:
    "Esa imagen ya se ha adjuntado: elige otra o vuelve a subirla.",
};

/**
 * ¿Los primeros bytes son de una foto? Se aceptan los formatos con los que se
 * fotografía una avería; no SVG, que es un documento con scripts y no una foto.
 */
function looksLikeImage(head: Uint8Array): boolean {
  const starts = (...bytes: number[]) =>
    bytes.every((byte, index) => head[index] === byte);
  // JPEG, PNG, GIF y BMP: su firma es la primera.
  if (starts(0xff, 0xd8, 0xff)) return true;
  if (starts(0x89, 0x50, 0x4e, 0x47)) return true;
  if (starts(0x47, 0x49, 0x46, 0x38)) return true;
  if (starts(0x42, 0x4d)) return true;
  // WEBP: caja RIFF con su marca a los ocho bytes.
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return true;
  }
  // HEIC y AVIF: caja ISO-BMFF con la marca del formato.
  if (
    head[4] === 0x66 &&
    head[5] === 0x74 &&
    head[6] === 0x79 &&
    head[7] === 0x70
  ) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    return ["avif", "avis", "heic", "heix", "hevc", "mif1", "msf1"].some(
      (known) => brand === known,
    );
  }
  return false;
}

/** Un vale nuevo, largo y al azar: es lo único que acredita un archivo. */
function newTicket(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Dirección temporal de subida para una imagen del formulario público, con su
 * vale. El tope por hora es lo que impide que la puerta abierta se use para
 * meter archivos en serie: dentro de un taller, unos cuantos avisos con foto a
 * la hora no se acercan a este número.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - H;
    const recent = await ctx.db
      .query("reportUploads")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", since))
      .collect();
    if (recent.length >= MAX_UPLOADS_PER_HOUR) {
      throw new ConvexError(
        "El formulario ha recibido demasiados archivos en la última hora. Inténtalo de nuevo dentro de un rato.",
      );
    }

    const ticket = newTicket();
    await ctx.db.insert("reportUploads", { ticket, createdAt: Date.now() });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), ticket };
  },
});

/**
 * Acredita el archivo subido con su vale y devuelve la dirección con la que
 * enlazarlo en la descripción. Mira el archivo de verdad: si no es una foto, o
 * se pasa del límite, no se acepta.
 */
export const attachImage = action({
  args: { ticket: v.string(), storageId: v.id("_storage") },
  // Con el tipo escrito a mano: sin él, la acción y la mutación interna que
  // llama se referencian en círculo y TypeScript no sabe qué devuelve.
  handler: async (ctx, args): Promise<string> => {
    const file = await ctx.storage.get(args.storageId);
    if (!file) throw new ConvexError(REJECTION_MESSAGES.missingFile);
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const problem = !looksLikeImage(head)
      ? ("notAnImage" as const)
      : file.size > MAX_FILE_SIZE
        ? ("tooBig" as const)
        : undefined;

    const result = await ctx.runMutation(internal.reportUploads.claimImage, {
      ticket: args.ticket,
      storageId: args.storageId,
      ...(problem ? { problem } : {}),
    });
    if (!result.ok) throw new ConvexError(REJECTION_MESSAGES[result.reason]);
    if (result.url === null) {
      throw new ConvexError(
        "La imagen ya no está en el almacén del taller: vuelve a adjuntarla.",
      );
    }
    return result.url;
  },
});

/**
 * Acredita un archivo con su vale, ya mirado por la acción. Aquí se decide si el
 * vale vale, si el archivo es de este formulario y si se retira de donde esté.
 *
 * Un vale sirve una sola vez, y un archivo se acredita una sola vez: lo que
 * llegue de más se descarta en vez de quedarse ocupando sitio. Lo que no se hace
 * nunca es tocar un archivo que ya estaba en el almacén —el documento de un
 * expediente, por ejemplo—: de lo ajeno no se borra nada.
 *
 * No lanza: devuelve el motivo. Una mutación que lanza deshace sus escrituras, y
 * entre ellas estaría la retirada del archivo que sobra.
 */
export const claimImage = internalMutation({
  args: {
    ticket: v.string(),
    storageId: v.id("_storage"),
    problem: v.optional(uploadProblemValidator),
  },
  // El tipo va escrito a mano: la acción y esta mutación se llaman en círculo y
  // sin él TypeScript no sabe qué devuelve. (El proyecto no usa validadores de
  // salida: el contrato lo deja escrito el tipo.)
  handler: async (ctx, args): Promise<ClaimResult> => {
    const row = await ctx.db
      .query("reportUploads")
      .withIndex("by_ticket", (q) => q.eq("ticket", args.ticket))
      .unique();
    if (!row) return { ok: false as const, reason: "unknownTicket" as const };

    const file = await ctx.db.system.get("_storage", args.storageId);
    if (!file) return { ok: false as const, reason: "missingFile" as const };

    // ¿La ha subido este vale? Los dos sellos son del servidor y van en orden:
    // el archivo se sube después de que el vale diera su dirección de subida, así
    // que uno que se selló antes es de otro sitio —el documento de un expediente,
    // por ejemplo—. Con el sello del vale basta, y no con su `createdAt`: los dos
    // valen lo mismo, pero la hora del reloj solo llega al milisegundo.
    const mine = file._creationTime > row._creationTime;
    // Solo lo nuestro se retira; lo ajeno se deja donde está.
    const discard = async () => {
      if (mine) await ctx.storage.delete(args.storageId);
    };

    if (args.problem) {
      await discard();
      return { ok: false as const, reason: args.problem };
    }
    if (!mine) return { ok: false as const, reason: "foreignFile" as const };
    if (row.storageId !== undefined) {
      // El vale ya tenía su imagen: esta segunda sobra y no se queda.
      await discard();
      return { ok: false as const, reason: "ticketUsed" as const };
    }

    const claimed = await ctx.db
      .query("reportUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (claimed)
      return { ok: false as const, reason: "alreadyAttached" as const };

    await ctx.db.patch(row._id, {
      storageId: args.storageId,
      claimedAt: Date.now(),
    });
    return { ok: true as const, url: await ctx.storage.getUrl(args.storageId) };
  },
});

/**
 * Cuánto se mira hacia atrás al comparar una dirección con los vales acreditados:
 * una incidencia se notifica el mismo día que se hacen sus fotos, no una semana
 * después, y lo que nadie usó ya lo ha barrido la limpieza.
 */
const CLAIMED_LOOKUP_MS = 7 * 24 * H;

/** El id del archivo que hay detrás de la dirección de una imagen del almacén. */
function storageIdFromUrl(src: string): Id<"_storage"> | null {
  const match = /\/api\/storage\/([A-Za-z0-9_-]+)/.exec(src);
  return match ? (match[1] as Id<"_storage">) : null;
}

/** Las direcciones de las imágenes que cita un documento (también dentro de listas y citas). */
function documentImageSources(value: string | undefined): string[] {
  const sources: string[] = [];
  const walk = (blocks: readonly RichBlock[]) => {
    for (const block of blocks) {
      if (block.type === "image") {
        sources.push(block.src);
      } else if (block.type === "list") {
        for (const item of block.items) walk(item);
      } else if (block.type === "quote") {
        walk(block.blocks);
      }
    }
  };
  walk(richDocBlocks(value));
  return sources;
}

/**
 * ¿Esta dirección es la de un archivo que el formulario público acreditó? Lo
 * normal es leer el id en la propia dirección y resolverlo por su índice; si el
 * deployment sirve las direcciones de otra forma, se compara con las que
 * devuelve el propio almacenamiento para los vales acreditados de los últimos
 * días. Las dos puertas llevan al mismo sitio: solo pasan archivos acreditados.
 */
async function isClaimedReportImage(
  ctx: MutationCtx,
  src: string,
): Promise<boolean> {
  const id = storageIdFromUrl(src);
  if (id) {
    const row = await ctx.db
      .query("reportUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", id))
      .unique();
    if (row?.claimedAt !== undefined) return true;
  }

  const rows = await ctx.db
    .query("reportUploads")
    .withIndex("by_createdAt", (q) =>
      q.gt("createdAt", Date.now() - CLAIMED_LOOKUP_MS),
    )
    .collect();
  for (const row of rows) {
    if (!row.storageId || row.claimedAt === undefined) continue;
    if ((await ctx.storage.getUrl(row.storageId)) === src) return true;
  }
  return false;
}

/**
 * Comprueba las imágenes de una incidencia que llega del formulario público:
 * cada una tiene que ser un archivo acreditado aquí (`attachImage`). Es lo que
 * cierra dos puertas de un formulario sin sesión: que cite un archivo de dentro
 * de la aplicación —el documento de un expediente, la imagen de una nota— o una
 * imagen de fuera, y que se traiga un álbum entero bajo el brazo.
 */
export async function assertReportImages(
  ctx: MutationCtx,
  description: string | undefined,
): Promise<void> {
  const sources = documentImageSources(description);
  if (sources.length === 0) return;
  if (sources.length > MAX_REPORT_IMAGES) {
    throw new ConvexError(
      `Una incidencia puede llevar como mucho ${MAX_REPORT_IMAGES} imágenes.`,
    );
  }
  for (const src of sources) {
    if (!(await isClaimedReportImage(ctx, src))) {
      throw new ConvexError(
        "No se han podido comprobar las imágenes: vuelve a adjuntarlas con el botón de imagen y envía la incidencia otra vez.",
      );
    }
  }
}

/**
 * ¿Alguna incidencia cita este archivo? Solo puede hacerlo una creada después de
 * pedirse la subida (con un margen por el desfase de relojes), así que no hace
 * falta recorrer el histórico entero: se mira desde ese momento.
 *
 * Se busca el id —que es lo que guarda un documento adjunto— y también la
 * dirección del archivo, que es lo que queda escrito en una descripción o una
 * nota con imagen.
 */
async function isImageCited(
  // Vale para las dos lecturas: la pasada que borra y el panel que solo mira.
  ctx: MutationCtx | QueryCtx,
  storageId: Id<"_storage">,
  since: number,
): Promise<boolean> {
  const url = await ctx.storage.getUrl(storageId);
  const cited = (value: string | undefined) =>
    value !== undefined &&
    (value.includes(storageId) || (url !== null && value.includes(url)));

  const incidents = await ctx.db
    .query("incidents")
    .withIndex("by_createdAt", (q) => q.gt("createdAt", since - H))
    .collect();
  return incidents.some(
    (incident) =>
      cited(incident.description) ||
      (incident.documents ?? []).some((doc) => doc.storageId === storageId) ||
      (incident.lifecycleNotes ?? []).some((note) => cited(note.note)),
  );
}

/**
 * El archivo de un vale tal y como lo ve el almacén: su tipo y lo que ocupa. Sin
 * él —borrado a mano mientras el vale seguía ahí— no queda tamaño que apuntar ni
 * tipo que guardar, y la fila se va igual: el vale ya no vale para nada.
 */
async function storedFile(
  // Vale para las dos lecturas: la pasada que borra y el panel que solo mira.
  ctx: MutationCtx | QueryCtx,
  storageId: Id<"_storage">,
) {
  return (await ctx.db.system.get("_storage", storageId)) ?? null;
}

/** Lo que el almacén sabe de un archivo, tal y como lo devuelve `_storage`. */
type StoredFile = NonNullable<Awaited<ReturnType<typeof storedFile>>>;

/** Una fila del formulario que la próxima pasada se lleva, con su archivo. */
interface PendingUpload {
  row: Doc<"reportUploads">;
  /** El archivo del vale; sin él, el vale nunca llegó a tener imagen. */
  file: StoredFile | null;
}

/**
 * Lo que la próxima pasada del formulario se va a llevar: las filas que ya
 * cumplieron su ventana de cortesía y que ninguna incidencia cita. Es la misma
 * cuenta para los tres sitios que tienen que decir lo mismo —la pasada que las
 * retira, el aviso que la antecede y el panel de Ajustes del taller—, con el
 * mismo tope de tanda, para que el aviso no prometa más de lo que la noche hará.
 *
 * Se lee antes de borrar, que es la única forma de poder avisar de lo que viene;
 * y el archivo se mira aquí porque quien retira lo necesita para la papelera
 * (su tipo y su tamaño) y quien avisa, para contar lo que ocupa.
 */
async function pendingUnusedRows(
  // Vale para las dos lecturas: la pasada que borra y el panel que solo mira.
  ctx: MutationCtx | QueryCtx,
): Promise<{
  pending: PendingUpload[];
  /** La pasada se llena con su tanda: quedan más detrás, para otra noche. */
  partial: boolean;
}> {
  const cutoff = Date.now() - UNUSED_RETENTION_MS;
  const rows = await ctx.db
    .query("reportUploads")
    .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
    .take(SWEEP_LIMIT);

  const pending: PendingUpload[] = [];
  for (const row of rows) {
    if (
      row.storageId &&
      (await isImageCited(ctx, row.storageId, row.createdAt))
    ) {
      continue;
    }
    const file = row.storageId ? await storedFile(ctx, row.storageId) : null;
    pending.push({ row, file });
  }
  return { pending, partial: rows.length === SWEEP_LIMIT };
}

/**
 * Una pasada sobre lo que el formulario dejó por el camino: vales sin archivo,
 * archivos que no llegaron a acreditarse y archivos acreditados que ninguna
 * incidencia cita (el aviso se abandonó a medias). Una imagen que sí aparece en
 * una incidencia se queda: es parte de su ficha.
 *
 * La comparten la limpieza de la madrugada, la purga a mano del panel de Ajustes
 * del taller y la limpieza que se lanza a mano entera (`storageCleanup.runNow`,
 * en el módulo hermano), para que todas hagan exactamente lo mismo: lo que se
 * mira es lo que se retira. Solo se toca lo que ya cumplió su ventana de
 * cortesía —un día entero sin que nadie lo cite—, y va por tandas: si hay más,
 * la pasada siguiente sigue por donde esta lo dejó.
 *
 * Lo que se lleva va a la papelera (`./trash`), no al borrado: unos días para
 * arrepentirse. Por eso hay que decirle quién la lanza, que es lo que firma su
 * fila de la papelera.
 *
 * Y cuando la lanza una persona —y no la limpieza de la madrugada— deja además su
 * constancia en `reportUploadPurges`: quién, cuándo y qué se llevó, una entrada
 * por archivo con su vale, que es lo que permite leer una purga a mano meses
 * después. Va aquí, donde se retira, y no en los sitios desde los que se llama,
 * para que no pueda existir una purga a mano sin su firma.
 */
export async function sweepUnusedRows(
  ctx: MutationCtx,
  runBy: string,
): Promise<{
  removed: number;
  images: number;
  tickets: number;
  bytes: number;
}> {
  const { pending } = await pendingUnusedRows(ctx);

  let removed = 0;
  let images = 0;
  let tickets = 0;
  let bytes = 0;
  // Lo que se lleva, con su vale: es lo que firma la constancia de una purga a
  // mano. Los vales sin archivo van aparte porque no eran imágenes.
  const gone: { ticket: string; size: number }[] = [];
  const goneTickets: string[] = [];
  for (const { row, file } of pending) {
    if (row.storageId) {
      const size = file?.size ?? 0;
      bytes += size;
      await moveToTrash(ctx, {
        storageId: row.storageId,
        size,
        ...(file?.contentType !== undefined
          ? { contentType: file.contentType }
          : {}),
        pass: "reportUploads",
        runBy,
        ticket: row.ticket,
      });
      images += 1;
      gone.push({ ticket: row.ticket, size });
    } else {
      tickets += 1;
      goneTickets.push(row.ticket);
    }
    await ctx.db.delete(row._id);
    removed += 1;
  }

  // La constancia es de las purgas a mano: lo que retira la madrugada ya tiene la
  // suya en `storageCleanupRuns`, y firmarlo aquí también sería llenar el
  // registro de entradas que nadie va a leer. Una purga que no se llevó nada
  // tampoco deja fila: no hay nada que contar.
  if (removed > 0 && runBy !== AUTO_CLEANUP_BY) {
    await ctx.db.insert("reportUploadPurges", {
      runBy,
      ranAt: Date.now(),
      images: gone,
      tickets: goneTickets,
      bytes,
    });
  }
  return { removed, images, tickets, bytes };
}

/**
 * La limpieza de la madrugada. No toca nada del expediente, deja su constancia
 * firmada por la limpieza automática y devuelve cuántos retiró, que es lo que
 * miran las pruebas.
 */
export const sweepUnused = internalMutation({
  args: {},
  handler: async (ctx) => {
    const result = await sweepUnusedRows(ctx, AUTO_CLEANUP_BY);
    await recordCleanupRun(
      ctx,
      "reportUploads",
      { files: result.images, bytes: result.bytes, tickets: result.tickets },
      AUTO_CLEANUP_BY,
    );
    return result.removed;
  },
});

/**
 * El aviso que antecede a la pasada: mira lo que la limpieza de la madrugada se
 * va a llevar del formulario —la misma cuenta que ella hace, leída antes de
 * borrar— y se lo cuenta a quien gobierna el taller. Corre unos minutos antes de
 * la pasada (`crons.ts`), para que avise con lo que hay pendiente y no cuando ya
 * no esté: lo retirado espera unos días en la papelera, y saber qué se va a
 * perder es lo que permite decidir si hay que ir a por ello.
 *
 * No toca nada: ni retira, ni borra, ni deja constancia de una pasada que no ha
 * ocurrido. Con nada que barrer no avisa a nadie —un aviso que no cuenta nada es
 * ruido—, y a quien no coordina tampoco: el destinatario es el puesto que ve el
 * panel y rescata de la papelera (`coordinatorIds`). Devuelve cuántas personas lo
 * han recibido, que es lo que miran las pruebas.
 */
export const warnUnused = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { pending, partial } = await pendingUnusedRows(ctx);
    const images = pending.filter((item) => item.row.storageId !== undefined);
    const text = uploadSweepAlert({
      images: images.length,
      tickets: pending.length - images.length,
      bytes: images.reduce((total, item) => total + (item.file?.size ?? 0), 0),
      partial,
      // El plazo de la papelera lo ajusta el taller: el aviso dice el vigente, no
      // el de partida, para no prometer un margen que no es el que hay.
      retentionDays: await trashRetentionDays(ctx),
    });
    if (text === null) return 0;

    const recipients = await coordinatorIds(ctx);
    await notifyUsers(ctx, recipients, text);
    return recipients.length;
  },
});

/** Una imagen del formulario que nadie citó, tal y como la enseña el panel. */
type UnusedUploadImage = {
  id: Id<"reportUploads">;
  url: string | null;
  size: number;
  uploadedAt: number;
};

/**
 * Lo que la limpieza de la madrugada se va a llevar del formulario público: las
 * imágenes que ya cumplieron su ventana y que ninguna incidencia cita. Es la
 * misma cuenta que hace la pasada —la misma regla, leída antes de borrar—, para
 * que se pueda mirar y adelantar desde Ajustes del taller: quien gobierna el
 * taller ve qué hay ahí antes de que se lo lleve la noche.
 *
 * Se mira solo lo que la próxima pasada tiene delante (las más antiguas hasta
 * el tope de una tanda): lo que enseña es lo que se va a barrer, no una promesa
 * a meses vista. Lo que se acaba de subir no aparece a propósito: todavía puede
 * acabar en un aviso que alguien está escribiendo.
 */
export const unusedImages = query({
  args: {},
  handler: async (ctx) => {
    await requireCoordinator(ctx, "ver las imágenes sin usar del formulario");

    // La limpieza va por tandas: si esta se ha llenado, quedan más detrás.
    const { pending, partial } = await pendingUnusedRows(ctx);

    const images: UnusedUploadImage[] = [];
    let tickets = 0;
    for (const { row, file } of pending) {
      if (row.storageId === undefined) {
        // Un vale sin archivo: se va con las imágenes, pero no es una imagen.
        tickets += 1;
        continue;
      }
      images.push({
        id: row._id,
        url: await ctx.storage.getUrl(row.storageId),
        size: file?.size ?? 0,
        uploadedAt: row.createdAt,
      });
    }

    return {
      images,
      tickets,
      totalBytes: images.reduce((total, image) => total + image.size, 0),
      retentionMs: UNUSED_RETENTION_MS,
      partial,
    };
  },
});

/**
 * La purga a mano del panel de Ajustes del taller: barre ahora lo mismo que
 * barrería la pasada de esta noche, ni más ni menos. Lo que retira queda en la
 * papelera, igual que si lo hubiera retirado la madrugada. Devuelve cuántas
 * imágenes se han retirado, cuánto ocupaban y cuántos vales sin archivo se han
 * ido con ellas, que es lo que cuenta el aviso que ve quien purga.
 */
export const purgeUnused = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCoordinator(
      ctx,
      "purgar las imágenes sin usar del formulario",
    );
    const by = cleanupActor(user);
    const result = await sweepUnusedRows(ctx, by);
    // La misma pasada que mira la tarjeta de la limpieza, así que también deja
    // su constancia: si se purga a mano, la última pasada es esta y no la de
    // anoche.
    await recordCleanupRun(
      ctx,
      "reportUploads",
      { files: result.images, bytes: result.bytes, tickets: result.tickets },
      by,
    );
    return result;
  },
});
