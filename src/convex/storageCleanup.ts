import { v } from "convex/values";
import {
  AUTO_CLEANUP_BY,
  fileReading,
  unreadableFilesAlert,
} from "../lib/cleanupLog";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { cleanupActor, lastRun, recordCleanupRun } from "./cleanupLog";
import { notifyUsers } from "./notify";
import { coordinatorIds, requireCoordinator } from "./permissions";
import { sweepUnusedRows } from "./reportUploads";
import schema from "./schema";
import { moveToTrash, purgeExpiredRows } from "./trash";

/**
 * Limpieza del almacenamiento: retira los archivos que ya no cita nadie.
 *
 * Un archivo se sube antes de saber si llega a quedarse: la foto que se elige
 * para una nota y luego no se guarda, la que se quita del texto al corregirlo,
 * la que se sube y se abandona a medias. Son archivos que ocupan sitio en el
 * almacén del taller y a los que no llega ninguna ficha. Esta pasada —una vez al
 * día, de madrugada— los borra.
 *
 * Solo se borra lo que nadie menciona. Las cadenas de la base se recorren una
 * sola vez —cada tabla del esquema y, dentro de cada documento, todas sus
 * cadenas— y de esa vuelta sale apuntado lo que cita un archivo: su id, en el
 * campo que lo guarda o dentro de la dirección con la que se enlaza. Da igual
 * dónde esté: una nota, una versión antigua de una nota, la descripción de una
 * incidencia, el documento de un expediente, el adjunto de una petición o el
 * texto de un mensaje. Mientras algo lo mencione, el archivo se queda. Y como ya
 * quedó apuntado, decidir cada archivo es una pregunta a un conjunto y no otra
 * vuelta por la base.
 *
 * La regla vale igual para una foto que para el archivo de un documento: si
 * nadie lo menciona, no es de nadie.
 *
 * Y hay archivos que no se pueden leer. El almacén puede tener en su lista un
 * archivo al que no da dirección con la que abrirlo, y una ficha puede seguir
 * citando una dirección que ya no lleva a ninguna parte. De esos no se decide
 * nada —tampoco que no los cite nadie—, así que no se retiran: se cuentan aparte
 * y se señalan (la constancia de la pasada, que es lo que enseña Ajustes del
 * taller, y un aviso a quien coordina cuando la cuenta cambia). Retirar un
 * archivo que no se ha podido leer es la forma de borrar algo en uso.
 *
 * Se mira a lo bruto a propósito. Las imágenes de una nota no llevan una fila que
 * las apunte —en el texto va su dirección—, así que la única pregunta que se
 * puede responder con certeza es «¿lo menciona algo de lo que hay guardado?». Si
 * un campo se quedara fuera de la lectura, esta pasada borraría un archivo en
 * uso; por eso se leen todas las tablas y no una lista de campos escogidos a
 * mano, que es la que se quedaría vieja. Y lo que se busca escrito son los ids
 * que el almacén tiene delante, no una forma supuesta —un largo mínimo, un
 * prefijo—: buscar un id que no existe no puede marcar nada, y buscar solo los
 * que existen alcanza a todas las maneras en que un archivo llega a estar citado.
 * De esa vuelta por la base lo único que se lleva en memoria es lo que aparece
 * citado —los ids y las direcciones que se escriben—, así que la pasada crece con
 * lo que la base guarda y no con lo que guarda por cada archivo que hay en el
 * almacén. Y como todo va en una sola transacción, si la lectura fallara —la base
 * no cupiera en lo que Convex deja leer de una vez— la pasada no borraría nada.
 *
 * Los archivos del formulario público no son cosa de esta limpieza: mientras
 * tengan su vale en `reportUploads`, lo que se lee aquí los menciona y se dejan
 * en paz. De ellos se encarga `reportUploads.sweepUnused`, que además sabe qué
 * incidencia los cita —y que es la otra mitad de `runNow`, la limpieza a mano
 * de Ajustes del taller, que hace las dos pasadas de una vez y por eso vive
 * aquí, donde las dos se ven juntas—.
 *
 * Cada pasada deja constancia en `storageCleanupRuns` (`./cleanupLog`): cuándo
 * fue, qué retiró y quién la lanzó. Es lo que enseña Ajustes del taller, y sin
 * ello la única forma de saber si la limpieza hizo algo sería mirar lo que
 * queda, que no dice nada de lo que ya se llevó.
 *
 * Lo que se retira va a la papelera (`./trash`), no al borrado: unos días para
 * arrepentirse. Quien borra de verdad es la tercera pasada, la de la papelera,
 * que va después.
 */

const H = 60 * 60 * 1000;

/**
 * Margen antes de dar por perdido un archivo. Se sube antes de saber si se
 * queda —mientras se escribe la nota, el texto todavía no está guardado—, así
 * que solo se mira lo que lleva un día entero sin que nadie lo mencione. Es el
 * mismo margen que usa la limpieza del formulario público.
 */
export const ORPHAN_FILE_RETENTION_MS = 24 * H;

/**
 * Cuántos archivos se retiran como mucho en una pasada. La limpieza no tiene
 * prisa: si queda más, la de mañana sigue por donde esta lo dejó. El tope evita
 * que una pasada se pase del presupuesto de una transacción borrando miles de
 * archivos de golpe.
 */
const SWEEP_LIMIT = 100;

/** Lo que se busca escrito dentro de un texto, y con qué ventanas se busca. */
type CitationIndex = {
  /** Las formas que se buscan: el id de un archivo y la dirección con la que se
   * sirve. Es el conjunto al que se le pregunta si una ventana es una de ellas. */
  needles: Set<string>;
  /** Una ventana por cada largo distinto que tengan esas formas. */
  windows: RegExp[];
};

/**
 * Lo que se busca escrito dentro de un texto: las formas que el taller tiene
 * delante —el id de cada archivo del almacén y la dirección con la que se sirve—,
 * sin suponer nada de cómo son. Ni un largo mínimo ni un prefijo: los largos y los
 * caracteres salen de las propias formas que se buscan.
 *
 * Se buscan con ventanas: un tramo del texto del largo exacto de una forma, en
 * cualquier sitio donde quepa, y a preguntar si es una de ellas. Cabe donde haya
 * un tramo de caracteres como los suyos, que es donde de verdad puede estar
 * escrita. Una forma que no esté en el almacén no puede marcar nada, y las que
 * están cubren todas las maneras en que un archivo llega a estar citado —el valor
 * de un campo, dentro de una dirección, suelto en una nota—.
 */
function citationIndex(forms: Iterable<string>): CitationIndex {
  const needles = new Set(forms);
  const alphabet = [...new Set([...needles].flatMap((form) => [...form]))];
  const windows = [...new Set([...needles].map((form) => form.length))].map(
    // La búsqueda va en un grupo de ancho cero a propósito: así se prueba en cada
    // posición del texto, y una forma escrita dentro de otra —el id de un archivo
    // dentro de la dirección de otro— no se pierde por caer en el hueco que ya se
    // había comido otra.
    (length) =>
      new RegExp(`(?=([${escapeForClass(alphabet)}]{${length}}))`, "g"),
  );
  return { needles, windows };
}

/**
 * Esos caracteres, tal y como se escriben dentro de una clase de patrón: los que
 * no son letras, números o guión bajo se escapan —el guión incluido, que dentro de
 * una clase es un intervalo—.
 */
function escapeForClass(characters: string[]): string {
  return characters
    .map((character) => character.replace(/[^A-Za-z0-9_]/g, (c) => `\\${c}`))
    .join("");
}

/**
 * Lo que cita una cadena —y lo que hay dentro, si es una lista o un objeto—,
 * apuntado en dos conjuntos: las formas que aparecen escritas —el id de un
 * archivo, la dirección con la que se sirve— y el sello de cada dirección del
 * almacén que algo menciona.
 *
 * El sello se apunta aparte porque una dirección escrita puede llevar añadidos
 * suyos —un dominio viejo, un parámetro de más— y lo que hay que saber entonces
 * es el sello, no la forma exacta con la que se escribió.
 */
function collectCitations(
  value: unknown,
  index: CitationIndex,
  cited: Set<string>,
  mentioned: Set<string>,
): void {
  if (typeof value === "string") {
    for (const window of index.windows) {
      for (const match of value.matchAll(window)) {
        if (match[1] !== undefined && index.needles.has(match[1])) {
          cited.add(match[1]);
        }
      }
    }
    // Lo que no lleva una dirección del almacén no puede ser un archivo suyo.
    if (value.includes(STORAGE_PATH)) {
      for (const match of value.matchAll(ADDRESS_IN_TEXT_RE)) {
        const token = addressToken(match[0]);
        if (token !== null) mentioned.add(token);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, index, cited, mentioned);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectCitations(item, index, cited, mentioned);
    }
  }
}

/**
 * Lo que la base cita, leído en una sola pasada por sus cadenas: cada cadena se
 * mira una vez y se apunta lo que trae —el id de un archivo, la dirección con la
 * que se enlaza—, sin quedarse con la base entera para preguntárselo después a
 * cada archivo.
 *
 * Se recorren todas las tablas del esquema, sin lista de excepciones: cualquier
 * campo puede citar un archivo, y una tabla que se dejara fuera de la lectura
 * sería un archivo en uso borrado por error.
 */
async function citations(
  ctx: MutationCtx,
  index: CitationIndex,
): Promise<{ cited: Set<string>; mentioned: Set<string> }> {
  const cited = new Set<string>();
  const mentioned = new Set<string>();
  for (const name of Object.keys(schema.tables)) {
    const documents = await ctx.db.query(name as TableNames).collect();
    for (const document of documents) {
      collectCitations(document, index, cited, mentioned);
    }
  }
  return { cited, mentioned };
}

/** El tramo de la dirección del almacén con el que se identifica un archivo. */
const STORAGE_ADDRESS_RE = /\/api\/storage\/([A-Za-z0-9_-]+)/;

/** El trozo de dirección que apunta al almacén: lo que se busca dentro de un texto. */
const STORAGE_PATH = "/api/storage/";

/** Una dirección escrita en algún sitio de lo que se guarda. */
const ADDRESS_IN_TEXT_RE = /https?:\/\/[^\s"'<>()\\]+/g;

/**
 * El sello con el que el almacén identifica un archivo dentro de su dirección. Se
 * compara el sello —y no la dirección entera— porque una dirección puede llevar
 * añadidos suyos sin dejar de ser la del mismo archivo.
 */
function addressToken(address: string | null): string | null {
  if (!address) return null;
  return STORAGE_ADDRESS_RE.exec(address)?.[1] ?? null;
}

/**
 * Retira del almacén los archivos que ya no cita ninguna nota ni ninguna versión
 * —ni ningún otro sitio de los que guarda la base—. Devuelve cuántos borró, que
 * es lo que miran las pruebas.
 *
 * `before` es hasta cuándo se considera que un archivo ya no está en uso; sin él
 * vale un día antes de ahora. La pasada nocturna va sin argumentos: el margen es
 * el que deja a una nota recibir su imagen y a la limpieza no pisarle el texto a
 * nadie. Las pruebas lo fijan para no depender del reloj.
 */
async function sweepOrphanRows(
  ctx: MutationCtx,
  cutoff: number,
  runBy: string,
): Promise<{ files: number; bytes: number; unreadable: number }> {
  const files = await ctx.db.system.query("_storage").collect();

  // Lo que el almacén puede leer de verdad: la dirección de cada archivo y el
  // sello con el que la identifica. Un archivo del que no sale dirección no se
  // puede leer, y de lo que no se lee no se decide nada.
  const addresses = new Map<Id<"_storage">, string>();
  const served = new Set<string>();
  let unreadable = 0;
  for (const file of files) {
    const address = await ctx.storage.getUrl(file._id);
    if (address === null) {
      unreadable += 1;
      continue;
    }
    addresses.set(file._id, address);
    const token = addressToken(address);
    if (token !== null) served.add(token);
  }

  // Lo que la base cita, en una sola vuelta por sus cadenas. Se busca escrito lo
  // que el taller tiene delante —el id de cada archivo del almacén y la dirección
  // con la que se sirve—, que es lo único que puede estar citando a un archivo: no
  // hay forma de citar que se quede fuera por no haberla supuesto.
  const { cited, mentioned } = await citations(
    ctx,
    citationIndex([...files.map((file) => file._id), ...addresses.values()]),
  );
  // Y las direcciones que algo cita y el almacén ya no sirve: archivos que se han
  // perdido y que una ficha sigue enseñando. Aquí no hay nada que retirar —del
  // archivo no queda nada en el almacén—, pero tampoco se pueden callar.
  //
  // Una dirección se reconoce por su forma —la misma que lee el resto de la
  // aplicación para volver de una dirección a su vale (`reportUploads`)—, así que
  // no hace falta que el almacén tenga algún archivo para empezar a buscarlas.
  //
  // Se cuentan una sola vez: la misma foto citada en tres sitios sigue siendo un
  // archivo. Y se comparan por su sello contra las que el almacén sí sirve, que es
  // la única lista de la que fiarse: lo que el almacén no da es un archivo
  // perdido, no una dirección de otro sitio que se parezca.
  for (const token of mentioned) {
    if (!served.has(token)) unreadable += 1;
  }

  let removed = 0;
  let bytes = 0;
  for (const file of files) {
    if (removed >= SWEEP_LIMIT) break;
    // Lo que acaba de subirse todavía puede acabar en una nota: se deja para
    // otra noche.
    if (file._creationTime > cutoff) continue;
    const address = addresses.get(file._id) ?? null;
    // Cada archivo se decide por conjunto, con las dos formas con las que algo
    // puede estar citándolo: su id —lo que guarda un documento del expediente, el
    // adjunto de una petición o su propio vale— y la dirección tal cual —lo que
    // de verdad está escrito en una nota o en una versión antigua de una nota—.
    // La dirección suele llevar el id dentro, pero no se da por hecho.
    const fileCited =
      cited.has(file._id) || (address !== null && cited.has(address));
    // Solo se retira lo que se lee y no lo menciona nadie: lo citado se queda, y
    // lo que no se puede leer no se toca —ya está contado arriba—.
    if (fileReading({ address, cited: fileCited }) !== "orphan") continue;
    await moveToTrash(ctx, {
      storageId: file._id,
      size: file.size,
      ...(file.contentType !== undefined
        ? { contentType: file.contentType }
        : {}),
      pass: "orphanFiles",
      runBy,
    });
    removed += 1;
    bytes += file.size;
  }
  return { files: removed, bytes, unreadable };
}

/**
 * La pasada de la madrugada: barre lo que nadie cita y deja su constancia
 * firmada por la limpieza automática. Devuelve cuántos archivos se llevó, que es
 * lo que miran las pruebas.
 */
export const sweepOrphanFiles = internalMutation({
  args: { before: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = args.before ?? Date.now() - ORPHAN_FILE_RETENTION_MS;
    // Lo que dijo la pasada anterior: el aviso de lo que no se puede leer solo
    // vuelve a salir cuando la cuenta cambia.
    const previous = await lastRun(ctx, "orphanFiles");
    const result = await sweepOrphanRows(ctx, cutoff, AUTO_CLEANUP_BY);
    await recordCleanupRun(ctx, "orphanFiles", result, AUTO_CLEANUP_BY);
    // Lo que no se puede leer no se retira, así que quien coordina tiene que
    // enterarse de otra forma: es el único de los tres sitios donde el aviso
    // existe —la constancia y la pantalla son los otros dos—.
    const alert = unreadableFilesAlert({
      unreadable: result.unreadable,
      before: previous?.unreadable ?? 0,
    });
    if (alert !== null) {
      await notifyUsers(ctx, await coordinatorIds(ctx), alert);
    }
    return result.files;
  },
});

/** Lo que retiró cada pasada de la limpieza a mano, tal y como lo cuenta el
 * aviso que ve quien la lanza. */
export interface ManualCleanupSummary {
  reportUploads: {
    files: number;
    bytes: number;
    tickets: number;
    unreadable: number;
  };
  orphanFiles: { files: number; bytes: number; unreadable: number };
  trash: { files: number; bytes: number };
}

/**
 * Quién lanza la limpieza a mano, ya comprobado contra el permiso de coordinar.
 *
 * Una acción no tiene base de datos: el único sitio donde se puede leer el
 * permiso es una función con `ctx.db`, y esta es. Devuelve además el nombre que
 * firman las tres pasadas, para que no haya que volver a leerlo —ni volver a
 * comprobar el permiso— en cada una: la lectura de la base que pide el mandato es
 * esta, una sola vez.
 */
export const manualCleanupActor = internalQuery({
  args: {},
  handler: async (ctx): Promise<string> => {
    const user = await requireCoordinator(
      ctx,
      "lanzar la limpieza del almacén",
    );
    return cleanupActor(user);
  },
});

/**
 * La pasada del formulario público de la limpieza a mano: los vales que nadie
 * acreditó y las imágenes abandonadas. Va en su propia transacción y firma con el
 * nombre ya comprobado por la acción.
 */
export const runReportUploadsPass = internalMutation({
  args: { runBy: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    files: number;
    bytes: number;
    tickets: number;
    unreadable: number;
  }> => {
    // Las imágenes son las que cuentan como archivos; los vales sin archivo se
    // van con ellas, y los vales cuyo archivo ya no se puede leer se cuentan
    // aparte en vez de pasar por imágenes de 0 KB.
    const uploads = await sweepUnusedRows(ctx, args.runBy);
    const reportUploads = {
      files: uploads.images,
      bytes: uploads.bytes,
      tickets: uploads.tickets,
      unreadable: uploads.unreadable,
    };
    await recordCleanupRun(ctx, "reportUploads", reportUploads, args.runBy);
    return reportUploads;
  },
});

/**
 * La pasada de los archivos que no cita nadie, en su propia transacción. Es la
 * única que lee *toda* la base para saber qué menciona a cada archivo; por eso va
 * sola, para que su lectura no arrastre a las demás pasadas si la base crece.
 */
export const runOrphanFilesPass = internalMutation({
  args: { runBy: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ files: number; bytes: number; unreadable: number }> => {
    const orphanFiles = await sweepOrphanRows(
      ctx,
      Date.now() - ORPHAN_FILE_RETENTION_MS,
      args.runBy,
    );
    await recordCleanupRun(ctx, "orphanFiles", orphanFiles, args.runBy);
    return orphanFiles;
  },
});

/**
 * La pasada de la papelera, en su propia transacción: es la que borra de verdad
 * lo que ya cumplió su plazo. Va la última porque lo que acaban de retirar las
 * otras dos todavía no le toca.
 */
export const runTrashPass = internalMutation({
  args: { runBy: v.string() },
  handler: async (ctx, args): Promise<{ files: number; bytes: number }> => {
    const trash = await purgeExpiredRows(ctx);
    await recordCleanupRun(ctx, "trash", trash, args.runBy);
    return trash;
  },
});

/**
 * «Ejecutar ahora»: las tres pasadas del almacén, a mano y en el momento, desde
 * Ajustes del taller. Hace exactamente lo que haría la madrugada —el formulario
 * público primero, los archivos sin citar después y la papelera al final, en ese
 * orden—, para que el botón no prometa nada que la noche no fuera a hacer igual,
 * y deja la misma constancia que la automática, esta vez firmada por quien lo
 * pulsó.
 *
 * Es una acción y no una mutación porque cada pasada va en su propia transacción:
 * la del formulario mira sus vales, la de los archivos sin citar lee toda la base
 * y la de la papelera mira lo caducado. Encadenarlas en una sola transacción
 * obligaba a leer la base entera con las escrituras de la primera ya encima y a
 * que un fallo de la última deshiciera lo que las anteriores ya habían hecho;
 * separadas, cada una tiene su presupuesto y su fallo no arrastra a las demás.
 *
 * Lo que no cambia es el reparto ni el orden: se ejecutan una tras otra y cada una
 * ve lo que dejó escrito la anterior, así que lo que ya retiró la del formulario
 * —en la papelera, y es su fila la que lo menciona— no lo vuelve a tocar la de los
 * archivos sin citar; y lo que esta acaba de retirar tiene su plazo por delante y
 * no le toca todavía a la papelera. Ninguna pasada repite el trabajo de otra, y la
 * lectura de toda la base la hace una sola: la de los archivos sin citar.
 *
 * El permiso y el nombre se leen una sola vez, al principio
 * (`manualCleanupActor`), y las tres pasadas firman con ese nombre: sin él, una
 * purga a mano sin constancia volvería a ser posible.
 */
export const runNow = action({
  args: {},
  handler: async (ctx): Promise<ManualCleanupSummary> => {
    const runBy = await ctx.runQuery(
      internal.storageCleanup.manualCleanupActor,
      {},
    );
    const reportUploads = await ctx.runMutation(
      internal.storageCleanup.runReportUploadsPass,
      { runBy },
    );
    const orphanFiles = await ctx.runMutation(
      internal.storageCleanup.runOrphanFilesPass,
      { runBy },
    );
    const trash = await ctx.runMutation(internal.storageCleanup.runTrashPass, {
      runBy,
    });
    return { reportUploads, orphanFiles, trash };
  },
});
