/**
 * Los avisos de incidencia que se quedan en el dispositivo cuando no hay red.
 *
 * Un técnico en un sótano, en una sala de máquinas o en un plató sin cobertura
 * sigue viendo el problema delante: lo que no puede es esperar a tener barras
 * para escribirlo. El formulario público guarda entonces el aviso en el propio
 * navegador —IndexedDB, que aguanta un cierre de pestaña y no tiene el límite de
 * tamaño de `localStorage`— y lo envía solo cuando vuelve la conexión.
 *
 * Cada borrador lleva un identificador de cliente (`id`) que viaja con el alta
 * como `clientDraftId`. Es el centinela contra los duplicados: si el envío llega
 * al servidor y la respuesta se pierde por el camino —o el navegador reintenta
 * al recuperar la red—, el alta se reconoce por ese identificador y no se crea
 * dos veces la misma incidencia.
 *
 * Aquí no hay React ni Convex a propósito (igual que `lib/pagination` o
 * `lib/audit`): las reglas que se pueden probar sin navegador —cómo se numera un
 * borrador, qué se considera un borrador válido, en qué orden se envían— están
 * escritas como funciones, y lo que habla con IndexedDB queda en las cuatro
 * llamadas del final, que se callan cuando no hay almacenamiento (un navegador
 * privado, un entorno de pruebas) en vez de romper el formulario.
 */

/** Lo que hay que mandar al dar de alta la incidencia, tal y como se guardó. */
export interface OfflineDraftPayload {
  reporterName: string;
  reporterEmail?: string;
  reporterRole?: string;
  location?: string;
  equipmentKind?: string;
  model?: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
}

/** Un aviso escrito sin conexión, esperando su turno para salir. */
export interface OfflineIncidentDraft {
  /** Identificador del cliente: es también el `clientDraftId` del alta. */
  id: string;
  payload: OfflineDraftPayload;
  /** Cuándo se escribió, para enviarlos en el orden en que se escribieron. */
  savedAt: number;
}

/** Nombre de la base y del almacén; la versión se sube al cambiar su forma. */
const DB_NAME = "pulso-taller";
const DB_VERSION = 1;
const STORE = "incidentDrafts";

/**
 * Un identificador de borrador, único para este navegador.
 *
 * No se usa `crypto.randomUUID` porque no está en todos los navegadores que
 * abren la app en una tableta del taller, y porque el valor no es un secreto: es
 * una marca para reconocer el mismo envío, no una credencial. El tiempo va
 * delante para que dos borradores seguidos no se parezcan y para poder leerlos
 * en orden si algún día hay que mirarlos a mano.
 */
export function clientDraftId(
  now: number = Date.now(),
  random: () => number = Math.random,
): string {
  const base = Math.max(0, Math.trunc(now)).toString(36);
  const noise = Math.floor(Math.abs(random()) * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `draft-${base}-${noise}`;
}

/** Si este navegador puede guardar borradores (IndexedDB disponible). */
export function isOfflineDraftStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Si un valor leído del almacenamiento sirve como borrador. IndexedDB puede
 * tener lo que dejó una versión anterior de la app: se comprueba la forma antes
 * de fiarse de ella, y lo que no encaja se descarta sin más.
 */
export function isOfflineIncidentDraft(
  value: unknown,
): value is OfflineIncidentDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<OfflineIncidentDraft>;
  if (typeof draft.id !== "string" || draft.id.trim() === "") return false;
  if (!Number.isFinite(draft.savedAt)) return false;
  const payload = draft.payload as Partial<OfflineDraftPayload> | undefined;
  if (typeof payload !== "object" || payload === null) return false;
  return (
    typeof payload.reporterName === "string" &&
    payload.reporterName.trim() !== "" &&
    typeof payload.description === "string" &&
    Number.isFinite(payload.reportedAt)
  );
}

/**
 * Los borradores en el orden en que se escribieron: el primero que se guardó es
 * el primero que se manda, para que la cola del taller los reciba como pasaron.
 */
export function sortOfflineDrafts(
  drafts: readonly OfflineIncidentDraft[],
): OfflineIncidentDraft[] {
  return [...drafts].sort((a, b) => a.savedAt - b.savedAt);
}

/** Lo que se le dice a quien acaba de guardar un aviso sin red. */
export const OFFLINE_DRAFT_SAVED_NOTICE =
  "Guardado localmente. Se enviará al recuperar la conexión.";

/** Lo que se le dice mientras haya avisos esperando en el dispositivo. */
export function pendingDraftsNotice(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1)
    return "Hay 1 aviso guardado en este dispositivo sin enviar.";
  return `Hay ${count} avisos guardados en este dispositivo sin enviar.`;
}

/** Abre —o crea— la base de los borradores. */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_savedAt", "savedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("No se pudo abrir el almacenamiento local."),
      );
  });
}

/** Una escritura completa, con la transacción cerrada antes de resolver. */
function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let request: IDBRequest<T> | void = undefined;
        try {
          request = work(store);
        } catch (error) {
          db.close();
          reject(error);
          return;
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(request ? (request.result ?? null) : null);
        };
        transaction.onerror = () => {
          db.close();
          reject(
            transaction.error ??
              new Error("No se pudo completar la operación en el almacén."),
          );
        };
        transaction.onabort = () => {
          db.close();
          reject(
            transaction.error ?? new Error("La operación se ha cancelado."),
          );
        };
      }),
  );
}

/**
 * Guarda un aviso para enviarlo luego. Devuelve `false` cuando el navegador no
 * deja guardar nada: el formulario entonces lo dice en vez de prometer un envío
 * que no va a ocurrir.
 */
export async function saveOfflineDraft(
  draft: OfflineIncidentDraft,
): Promise<boolean> {
  if (!isOfflineDraftStorageAvailable() || !isOfflineIncidentDraft(draft)) {
    return false;
  }
  try {
    await runTransaction("readwrite", (store) => store.put(draft));
    return true;
  } catch {
    return false;
  }
}

/** Los avisos guardados, del más antiguo al más reciente. */
export async function listOfflineDrafts(): Promise<OfflineIncidentDraft[]> {
  if (!isOfflineDraftStorageAvailable()) return [];
  try {
    const stored = await runTransaction("readonly", (store) => store.getAll());
    if (!Array.isArray(stored)) return [];
    return sortOfflineDrafts(stored.filter(isOfflineIncidentDraft));
  } catch {
    return [];
  }
}

/** Olvida un aviso ya enviado (o descartado a mano). */
export async function deleteOfflineDraft(id: string): Promise<boolean> {
  if (!isOfflineDraftStorageAvailable()) return false;
  try {
    await runTransaction("readwrite", (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}

/** Cuántos avisos esperan en este dispositivo. */
export async function countOfflineDrafts(): Promise<number> {
  return (await listOfflineDrafts()).length;
}
