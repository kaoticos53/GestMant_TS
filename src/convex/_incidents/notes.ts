import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { hasCapability } from "../permissions";
import { richDocToStore } from "../../lib/richDoc";
import {
  NOTE_EDIT_WINDOW_MS,
  isNoteWithinEditWindow,
} from "../../lib/workshop";
import { secureMutation } from "../_auth/secureMutation";
import {
  type Actor,
  type LifecycleNote,
  actorName,
  assertIncidentNotModified,
  getIncident,
  incidentWorkerPolicy,
} from "./helpers";

/**
 * Una nota solo la cambia quien la escribió, y solo dentro del plazo.
 */
function requireNoteOwnership(
  actor: Actor,
  entry: LifecycleNote,
  now: number,
): void {
  if (entry.authorId === undefined) {
    throw new ConvexError(
      "Esta nota ya forma parte del historial de la incidencia y no se puede cambiar.",
    );
  }
  if (entry.authorId !== actor._id) {
    throw new ConvexError(
      "Solo quien escribió la nota puede corregirla o retirarla.",
    );
  }
  // Se cuenta desde que se escribió de verdad: `at` puede ser retroactiva.
  if (!isNoteWithinEditWindow(entry.createdAt ?? entry.at, now)) {
    throw new ConvexError(
      `El plazo para corregir una nota son ${Math.round(
        NOTE_EDIT_WINDOW_MS / 60_000,
      )} minutos, y la de esta incidencia ya ha terminado.`,
    );
  }
}

/**
 * Una nota retirada ya no está en el cuaderno: hay que recuperarla antes de
 * volver a tocarla (corregirla o retirarla otra vez).
 */
function requireLiveNote(entry: LifecycleNote): void {
  if (entry.deletedAt !== undefined) {
    throw new ConvexError(
      "Esa nota está retirada: recupérala desde la ficha de la incidencia para poder cambiarla.",
    );
  }
}

/** Posición de una nota en el hilo, localizada por su identificador propio. */
function noteIndex(notes: LifecycleNote[], noteId: string): number {
  const index = notes.findIndex((entry) => entry.id === noteId);
  if (index === -1) {
    throw new ConvexError("Esa nota ya no está en la incidencia.");
  }
  return index;
}

/** Añade una nota fechada a la incidencia (autor y momento). */
const addNoteArgs = {
  incidentId: v.id("incidents"),
  note: v.string(),
  at: v.optional(v.number()),
  expectedUpdatedAt: v.optional(v.number()),
};

export const addNote = mutation({
  args: addNoteArgs,
  handler: secureMutation(
    {
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
      authorize: incidentWorkerPolicy(
        "Solo el técnico asignado o quien coordina la incidencia pueden añadir notas.",
      ),
    },
    addNoteArgs,
    async (ctx, args, actor) => {
      const incident = await getIncident(ctx, args.incidentId);
      assertIncidentNotModified(incident, args.expectedUpdatedAt);
      // El cuaderno admite formato (negritas, listas, imágenes), así que lo que
      // se guarda es el documento del editor, ya recortado de párrafos vacíos: si
      // al final no dice nada, no hay nota.
      const noteText = richDocToStore(args.note);
      if (noteText === undefined) {
        throw new ConvexError("Escribe una nota válida.");
      }
      const now = Date.now();
      const when = args.at ?? now;
      // `at` es la fecha que se ve en el hilo (puede ser retroactiva) y
      // `createdAt` es cuándo se escribió de verdad: desde ahí se cuenta el plazo
      // para poder corregirla.
      const entry: LifecycleNote = {
        note: noteText,
        author: actorName(actor),
        authorId: actor._id,
        id: crypto.randomUUID(),
        at: when,
        createdAt: now,
      };
      await ctx.db.patch(args.incidentId, {
        updatedAt: now,
        // El ciclo de vida se lee siempre en orden cronológico, aunque una nota
        // llegue con una fecha anterior (p. ej. al reconstruir el historial).
        lifecycleNotes: [...(incident.lifecycleNotes ?? []), entry].sort(
          (a, b) => a.at - b.at,
        ),
      });
      return entry.id;
    },
  ),
});

/**
 * Corrige el texto de una nota propia. La fecha del hilo no se toca, así que la
 * nota no cambia de sitio en el cuaderno aunque se escribiera retroactiva: solo
 * queda anotado cuándo se corrigió. Tampoco se pierde lo que decía antes: cada
 * corrección archiva el texto anterior con su momento, y el historial viaja con
 * la nota (también si se retira y se recupera).
 */
const updateNoteArgs = {
  incidentId: v.id("incidents"),
  noteId: v.string(),
  note: v.string(),
  expectedUpdatedAt: v.optional(v.number()),
};

export const updateNote = mutation({
  args: updateNoteArgs,
  handler: secureMutation(
    {
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    },
    updateNoteArgs,
    async (ctx, args, actor) => {
      const incident = await getIncident(ctx, args.incidentId);
      assertIncidentNotModified(incident, args.expectedUpdatedAt);
      const notes = incident.lifecycleNotes ?? [];
      const index = noteIndex(notes, args.noteId);
      const now = Date.now();
      requireNoteOwnership(actor, notes[index], now);
      requireLiveNote(notes[index]);

      // El cuaderno admite formato (negritas, listas, imágenes), así que lo que
      // se guarda es el documento del editor, ya recortado de párrafos vacíos: si
      // al final no dice nada, no hay corrección que hacer.
      const noteText = richDocToStore(args.note);
      if (noteText === undefined) {
        throw new ConvexError("Escribe una nota válida.");
      }
      // Guardar sin cambiar nada no corrige ni fecha nada: el historial solo
      // recoge correcciones de verdad.
      if (noteText === notes[index].note) return;

      const updated = [...notes];
      updated[index] = {
        ...notes[index],
        note: noteText,
        editedAt: now,
        versions: [
          ...(notes[index].versions ?? []),
          { note: notes[index].note, at: now },
        ],
      };
      await ctx.db.patch(args.incidentId, {
        updatedAt: now,
        lifecycleNotes: updated,
      });
    },
  ),
});

/**
 * Devuelve la nota a una versión anterior de su propio historial: vuelve a
 * decir lo que decía antes sin borrar nada de lo que pasó. Es una corrección al
 * revés, así que la firma el mismo autor y dentro del mismo plazo que cualquier
 * otra, y el texto que había antes se archiva igual; pero queda anotado que fue
 * una restauración, quién la hizo y a qué versión se volvió. Quien lee el
 * cuaderno —o el informe— ve que la nota se devolvió a lo que decía tal día, no
 * que su autor la reescribiera a mano.
 *
 * Restaurar no alarga el plazo: se cuenta desde que la nota se escribió, así
 * que devolver una versión no reabre una nota que ya era histórico.
 */
const restoreNoteVersionArgs = {
  incidentId: v.id("incidents"),
  noteId: v.string(),
  /**
   * Posición de la versión en el historial guardado. Se identifica por su
   * sitio y no por su fecha porque dos correcciones seguidas pueden caer en
   * el mismo instante (mismo milisegundo) y la fecha no distinguiría una de
   * otra; el historial solo crece por el final, así que la posición no se
   * mueve.
   */
  versionIndex: v.number(),
};

export const restoreNoteVersion = mutation({
  args: restoreNoteVersionArgs,
  handler: secureMutation(
    {
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    },
    restoreNoteVersionArgs,
    async (ctx, args, actor) => {
      const incident = await getIncident(ctx, args.incidentId);
      const notes = incident.lifecycleNotes ?? [];
      const index = noteIndex(notes, args.noteId);
      const now = Date.now();
      requireNoteOwnership(actor, notes[index], now);
      requireLiveNote(notes[index]);

      const versions = notes[index].versions ?? [];
      const version = Number.isInteger(args.versionIndex)
        ? versions[args.versionIndex]
        : undefined;
      if (!version) {
        throw new ConvexError(
          "Esa versión ya no está en el historial de la nota.",
        );
      }
      // La nota ya dice eso: volver a restaurarla no inventa una corrección.
      if (version.note === notes[index].note) return;

      const updated = [...notes];
      updated[index] = {
        ...notes[index],
        note: version.note,
        editedAt: now,
        versions: [...versions, { note: notes[index].note, at: now }],
        restoredAt: now,
        restoredBy: actorName(actor),
        restoredVersion: args.versionIndex,
      };
      await ctx.db.patch(args.incidentId, {
        updatedAt: now,
        lifecycleNotes: updated,
      });
    },
  ),
});

/**
 * Retira una nota propia del cuaderno: deja de verse, pero no se pierde. Una
 * nota se borra por error con más facilidad de la que se escribe, así que
 * retirarla es reversible —queda anotado quién la retiró y cuándo, y se puede
 * recuperar desde la propia ficha— en vez de hacerla desaparecer sin remedio.
 */
const removeNoteArgs = {
  incidentId: v.id("incidents"),
  noteId: v.string(),
};

export const removeNote = mutation({
  args: removeNoteArgs,
  handler: secureMutation(
    {
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    },
    removeNoteArgs,
    async (ctx, args, actor) => {
      const incident = await getIncident(ctx, args.incidentId);
      const notes = incident.lifecycleNotes ?? [];
      const index = noteIndex(notes, args.noteId);
      const now = Date.now();
      requireNoteOwnership(actor, notes[index], now);
      requireLiveNote(notes[index]);

      const updated = [...notes];
      updated[index] = {
        ...notes[index],
        deletedAt: now,
        deletedBy: actorName(actor),
      };
      await ctx.db.patch(args.incidentId, {
        updatedAt: now,
        lifecycleNotes: updated,
      });
    },
  ),
});

/**
 * Devuelve al cuaderno una nota retirada: vuelve tal y como estaba y en su
 * sitio (no se reordena, porque nunca salió del hilo). La recupera quien la
 * escribió —que es quien puede borrarla— o quien coordina la incidencia, que es
 * el caso de un taller donde el autor ya no está para arreglar su propio
 * descuido. No hay plazo: recuperar algo perdido no reescribe nada.
 */
const restoreNoteArgs = {
  incidentId: v.id("incidents"),
  noteId: v.string(),
};

export const restoreNote = mutation({
  args: restoreNoteArgs,
  handler: secureMutation(
    {
      identityMessage:
        "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    },
    restoreNoteArgs,
    async (ctx, args, actor) => {
      const incident = await getIncident(ctx, args.incidentId);
      const notes = incident.lifecycleNotes ?? [];
      const index = noteIndex(notes, args.noteId);
      const note = notes[index];
      if (note.deletedAt === undefined) {
        throw new ConvexError("Esa nota ya está en el cuaderno.");
      }
      const isAuthor =
        note.authorId !== undefined && note.authorId === actor._id;
      const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
      if (!isAuthor && !canCoordinate) {
        throw new ConvexError(
          "Solo quien escribió la nota o quien coordina la incidencia pueden recuperarla.",
        );
      }

      // Vuelve tal y como estaba: se van solo las marcas de la retirada.
      const restored: LifecycleNote = { ...note };
      delete restored.deletedAt;
      delete restored.deletedBy;
      const updated = [...notes];
      updated[index] = restored;
      await ctx.db.patch(args.incidentId, {
        updatedAt: Date.now(),
        lifecycleNotes: updated,
      });
    },
  ),
});

/**
 * Edita el nombre, la nota o el archivo de un documento adjunto. Si llega un
 * `storageId` nuevo, sustituye al que tuviera y el anterior se borra del
 * almacén: reemplazar un archivo es dejarlo fuera, no guardarlo dos veces. El
 * reemplazo queda firmado en el rastro con su propio movimiento, porque no es
 * ni un renombrado ni una corrección de la nota.
 */
