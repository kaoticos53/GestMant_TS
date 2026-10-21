import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { scheduleReporterEmail, scheduleStaffEmail } from "./incidentMail";
import { registerIncidentIntake } from "./incidentIntake";
import { notifyUsers } from "./notify";
import { admitPublicLookup } from "./publicLookupLimits";
import {
  hasAnyCapability,
  hasCapability,
  memberOrNull,
  moderatorIds,
} from "./permissions";
import {
  canAdvanceIncident,
  incidentStepStatus,
  isIncidentInWorkshop,
  type IncidentAction,
  type IncidentStepStatus,
} from "../lib/incidentFlow";
import type { PendingPart } from "../lib/incidentTracking";
import { normalizePublicCode } from "../lib/publicCode";
import { isRequestAwaitingDelivery, lineRemaining } from "../lib/requestFlow";
import { richDocToPlainText, richDocToStore } from "../lib/richDoc";
import { normalizeIncidentReference } from "../lib/workshop";
import { INCIDENT_STATUSES, incidentStatusValidator } from "./schema";

import {
  actorName,
  getIncident,
  historyEntry,
  isModerator,
  requireActor,
  requireEquipmentEditor,
} from "./_incidents/helpers";

/**
 * Reporta una incidencia. Es la única función pública del módulo: el
 * notificador no tiene por qué estar registrado en la aplicación.
 *
 * El cuerpo es el de siempre y está en otro sitio: el caso de uso —qué se admite
 * y cómo queda la ficha, `lib/incidentIntake`— y su adaptador —la referencia, el
 * código, el alta, el aviso y el correo, `convex/incidentIntake`—. Aquí queda la
 * puerta: los argumentos que manda el formulario público y lo que recibe de
 * vuelta, que son las dos caras del mismo caso: la referencia con la que el
 * taller lo cita y el código con el que lo sigue quien avisó.
 */
export const report = mutation({
  args: {
    reporterName: v.string(),
    reporterRole: v.optional(v.string()),
    // Correo de quien notifica, si lo deja: solo sirve para avisarle cuando el
    // caso cambie de estado (`convex/incidentMail`). Opcional a propósito.
    reporterEmail: v.optional(v.string()),
    location: v.optional(v.string()),
    equipmentKind: v.optional(v.string()),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    description: v.string(),
    reportedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Ni una regla aquí: el caso de uso y su adaptador están a un salto
    // (`lib/incidentIntake` y `convex/incidentIntake`). Esta puerta solo existe
    // para que el formulario público tenga a quién llamar.
    return await registerIncidentIntake(ctx, args);
  },
});

/**
 * Cola de incidencias (más recientes primero). Requiere sesión. Por defecto
 * deja fuera lo archivado: el archivo se consulta aparte.
 */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Invitado o cuenta de baja: vacío en vez de error (el panel pide esta lista
    // al montar). El resto de acciones sigue exigiendo una cuenta (`requireActor`).
    if ((await memberOrNull(ctx)) === null) return [];
    const items = await ctx.db
      .query("incidents")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    // Lo retirado no está en ninguna de las dos caras de la cola: ni en el día a
    // día ni en el archivo. Vive en la papelera (`trash`), que es su propia
    // pantalla: colarlo aquí lo devolvería a las listas de las que se retiró.
    const live = items.filter((item) => item.deletedAt === undefined);
    const visible = args.includeArchived
      ? live
      : live.filter((item) => item.archivedAt === undefined);
    // Los documentos del expediente viajan con su enlace ya resuelto: la ficha
    // los abre tal cual, sin una consulta por documento. Es la misma forma que
    // devuelven los adjuntos de una petición.
    return await Promise.all(
      visible.map(async (item) => ({
        ...item,
        documents: await Promise.all(
          (item.documents ?? []).map(async (document) => ({
            ...document,
            url: document.storageId
              ? await ctx.storage.getUrl(document.storageId)
              : null,
          })),
        ),
      })),
    );
  },
});

/**
 * Los repuestos que el caso sigue esperando, contados para quien lo notificó: qué
 * repuesto, cuánta cantidad y desde cuándo.
 *
 * Sale de las peticiones vivas —ni retiradas a la papelera ni ya entregadas— y de
 * sus líneas, y de la petición no sale nada más que eso: ni su referencia
 * («PET-0007»), ni quién la pidió, ni el proveedor o el precio. Lo que falta es
 * concreto —«2 × Fuente de alimentación»— sin abrir el expediente del taller, que
 * es justo lo que el seguimiento no enseña.
 *
 * Se cuenta lo que **queda**, no lo que se pidió: una petición entregada a medias
 * enseña solo las unidades que aún están en el almacén. Una línea ya entregada
 * entera no se enseña, y por eso lo que sale en blanco es «no falta nada de esta
 * petición».
 *
 * Se ordena por fecha de petición: lo que lleva más tiempo esperando va primero,
 * que es lo que se mira cuando se pregunta cuándo llega.
 */
async function pendingPartsOf(
  ctx: QueryCtx | MutationCtx,
  incidentId: Id<"incidents">,
): Promise<PendingPart[]> {
  const requests = await ctx.db
    .query("partRequests")
    .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
    .collect();
  return requests
    .filter(
      (request) =>
        request.deletedAt === undefined &&
        isRequestAwaitingDelivery(request.status),
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((request) =>
      request.lines
        .map((line) => ({
          name: line.name,
          quantity: lineRemaining(line, request.status),
          since: request.createdAt,
        }))
        .filter((part) => part.quantity > 0),
    );
}

/**
 * El recorte del seguimiento: lo que se enseña de una incidencia fuera del
 * expediente del taller. Lo sirven las dos consultas —la de quien notificó, por
 * su código (`byCode`), y la del taller, por su referencia (`byReference`)—, y por
 * eso habla en código y no en referencia.
 *
 * Es una lista de campos explícita a propósito —y no «todo menos esto»—: una
 * columna nueva del esquema no se cuela aquí sola, y las notas internas, el
 * expediente y quién dio cada paso del historial se quedan dentro.
 */
async function trackingOf(
  ctx: QueryCtx | MutationCtx,
  incident: Doc<"incidents">,
) {
  return {
    // El código, no la referencia: fuera del taller el caso se llama por el
    // código que se le dio a quien notificó. La referencia es el número con el
    // que el taller se cita entre sí y no sale de aquí.
    code: incident.publicCode ?? null,
    status: incident.status,
    equipmentKind: incident.equipmentKind ?? null,
    model: incident.model ?? null,
    serialNumber: incident.serialNumber ?? null,
    location: incident.location ?? null,
    description: incident.description,
    reportedAt: incident.reportedAt,
    closedAt: incident.closedAt ?? null,
    // Quién la lleva: el técnico y, si ha pasado por taller, su responsable.
    assigneeName: incident.assigneeName ?? null,
    workshopAssigneeName: incident.workshopAssigneeName ?? null,
    // El historial, solo con el paso y su fecha: lo que cuenta cada paso y quién
    // lo dio es el cuaderno del taller, no lo que se le enseña al notificador.
    history: incident.history.map((entry) => ({
      status: entry.status,
      at: entry.at,
    })),
    // Qué falta, en concreto: los repuestos que aún no han llegado, con su
    // cantidad y desde cuándo se esperan. Es la respuesta a «¿por qué no está
    // todavía?» sin tener que abrir la petición.
    pendingParts: await pendingPartsOf(ctx, incident._id),
  };
}

/**
 * Seguir una incidencia por el código que se le dio a quien la notificó
 * («A7K2-QX9M»). Es la puerta de fuera del taller: la que usan el invitado que
 * avisó de una avería y cualquiera al que le hayan pasado un código.
 *
 * Está abierta a propósito, sin pedir sesión: el buscador de la portada y el
 * enlace del correo los usa gente que no ha entrado nunca en la aplicación, y
 * mandarla a una pantalla de acceso para leer el estado de su propio aviso es
 * justo lo contrario de lo que el código viene a resolver.
 *
 * Lo que cierra esta puerta no es una sesión, es el código: se reparte al azar
 * sobre 32 caracteres —más de un billón de combinaciones— y no dice nada de
 * nadie, así que ir probando no lleva a ningún caso. Y nunca devuelve la ficha
 * entera: lo que sale de aquí es el recorte de `trackingOf`, sin notas internas,
 * documentos ni adjuntos.
 *
 * El código es lo único que se acepta, y a propósito: la referencia interna —que
 * es un correlativo, «INC-0001», «INC-0002»…— la consulta el taller
 * (`byReference`, esa sí exige ser del taller). Aceptarla aquí dejaría la cola
 * entera al alcance de quien fuese probando números, que es justo lo que el
 * código viene a evitar.
 *
 * **Es una mutación y no una consulta** por el freno: cada código admite treinta
 * consultas por hora (`lib/publicLookup`), y contar una consulta es escribir. Una
 * consulta de Convex no puede escribir, así que el límite no se podría aplicar
 * sin dejar la puerta abierta a quien llamase a la función directamente. Se
 * cuenta antes de buscar —también los códigos que no llevan a nada— y, agotado el
 * cupo, se lanza el aviso con lo que falta para que vuelva: el freno que ya
 * protege el formulario de avisos (`incidents.report`), con el código como clave
 * porque sin sesión no hay otra identidad que contar.
 *
 * `null` si no hay ninguno con ese código —el panel lo cuenta como «no
 * encontramos ninguna»—, y también si lo escrito no tiene forma de código: lo que
 * no puede ser un código no gasta cupo, porque no llega a ser una consulta.
 */
export const byCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = normalizePublicCode(args.code);
    if (code === null) return null;
    await admitPublicLookup(ctx, code);
    // `first` y no `unique`, por lo mismo que en la referencia: una muestra
    // cargada o una instalación con datos viejos puede tener el mismo código dos
    // veces, y eso tiene que contestar (con el más antiguo) en vez de tumbar la
    // consulta de quien recibió el código.
    const incident = await ctx.db
      .query("incidents")
      .withIndex("by_publicCode", (q) => q.eq("publicCode", code))
      .first();
    // Una incidencia retirada no se sigue: se retiró porque es duplicada o
    // equivocada, así que su código deja de contar el caso. Si se recupera desde
    // la papelera, vuelve a contestar como si nunca hubiera pasado.
    if (incident === null || incident.deletedAt !== undefined) return null;
    return await trackingOf(ctx, incident);
  },
});

/**
 * Consultar una incidencia por su referencia interna («INC-0004»). Es el camino
 * del taller: la referencia se cita de viva voz y en los avisos internos, y
 * sirve para saber si el caso apuntado en un papel es el que ya está en la cola.
 *
 * Solo para quien es del taller —invitado y visitante se quedan fuera—: fuera
 * del taller, un correlativo que se puede ir probando sería la cola entera al
 * alcance de cualquiera. Quien notificó sigue su caso por el código que se le
 * dio (`byCode`).
 *
 * Nunca devuelve la ficha entera: lo que sale de aquí es el recorte de
 * `trackingOf`, sin notas internas, documentos ni adjuntos. `null` si no hay
 * ninguna con esa referencia o si lo escrito no lleva ningún número.
 */
export const byReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    if ((await memberOrNull(ctx)) === null) {
      throw new ConvexError(
        "Solo el taller puede consultar una incidencia por su referencia. Para seguir un caso de fuera hace falta el código que se dio al notificarlo.",
      );
    }
    const reference = normalizeIncidentReference(args.reference);
    if (reference === null) return null;
    // `first` y no `unique`: una instalación con datos viejos puede tener la
    // misma referencia repetida, y eso tiene que contestar (la más antigua) en
    // vez de tumbar la consulta de quien la recibió.
    const incident = await ctx.db
      .query("incidents")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .first();
    // Una incidencia retirada no se sigue: se retiró porque es duplicada o
    // equivocada, así que su referencia deja de contar el caso. Si se recupera
    // desde la papelera, vuelve a contestar como si nunca hubiera pasado.
    if (incident === null || incident.deletedAt !== undefined) return null;
    return await trackingOf(ctx, incident);
  },
});

/** El coordinador elige a qué técnico asignar (solo coordinadores). */
export const assign = mutation({
  args: {
    incidentId: v.id("incidents"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (!(await hasCapability(ctx, actor, "manageIncidents"))) {
      throw new ConvexError(
        isModerator(actor)
          ? "No tienes permisos para asignar incidencias. Revisa la configuración de tu rol con el administrador."
          : "Solo el coordinador puede asignar incidencias a otros técnicos. Los técnicos pueden autoasignarse las pendientes.",
      );
    }
    const incident = await getIncident(ctx, args.incidentId);
    const assigned = requireIncidentStep(
      incident,
      "assign",
      () => "Solo se puede asignar una incidencia pendiente o ya en curso.",
    );
    const assignee = await ctx.db.get(args.assigneeId);
    if (!assignee)
      throw new ConvexError("El técnico seleccionado ya no existe.");

    const now = Date.now();
    const assigneeName = actorName(assignee);
    await ctx.db.patch(args.incidentId, {
      status: assigned,
      assigneeId: assignee._id,
      assigneeName,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          assigned,
          now,
          actorName(actor),
          `Asignada a ${assigneeName}`,
        ),
      ],
    });
    await scheduleReporterEmail(ctx, incident, assigned);
    await scheduleStaffEmail(ctx, incident, assigned);
    await notifyUsers(
      ctx,
      [assignee._id],
      `${incident.reference} asignada a ti${incident.location ? ` · ${incident.location}` : ""}`,
      incident._id,
      actor._id,
    );
  },
});

/**
 * Autoasignación: cualquier técnico que vea la cola se lleva una pendiente.
 * La capacidad se comprueba en el backend como en el resto del módulo: sin
 * «ver la cola de incidencias» ni «gestionar incidencias» el rol no puede
 * llevarse trabajo aunque no tenga el módulo en el menú.
 */
export const selfAssign = mutation({
  args: { incidentId: v.id("incidents") },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    if (
      !(await hasAnyCapability(ctx, actor, [
        "viewIncidents",
        "manageIncidents",
      ]))
    ) {
      throw new ConvexError(
        "Solo quien ve la cola de incidencias puede autoasignarse las pendientes. Revisa la configuración de tu rol con el administrador.",
      );
    }
    const incident = await getIncident(ctx, args.incidentId);
    const assigned = requireIncidentStep(incident, "selfAssign", () =>
      incident.assigneeName
        ? `Ya está asignada a ${incident.assigneeName}.`
        : "Esta incidencia ya no está pendiente de asignación.",
    );

    const now = Date.now();
    const name = actorName(actor);
    await ctx.db.patch(args.incidentId, {
      status: assigned,
      assigneeId: actor._id,
      assigneeName: name,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(assigned, now, name, "Autoasignada por el técnico"),
      ],
    });
    await scheduleReporterEmail(ctx, incident, assigned);
    await scheduleStaffEmail(ctx, incident, assigned);
    await notifyUsers(
      ctx,
      await moderatorIds(ctx),
      `${incident.reference} autoasignada por ${name}`,
      incident._id,
      actor._id,
    );
  },
});

/** El paso que corresponde a lo que se elige en el diálogo de verificación. */
const VERIFY_STEPS = {
  onsite: "verifyOnsite",
  workshop: "verifyWorkshop",
  unresolved: "verifyUnresolved",
} as const satisfies Record<string, IncidentAction>;

/**
 * Verificación de una incidencia asignada:
 * - "onsite": se resuelve in situ → queda cerrada (resuelta).
 * - "workshop": hay que desplazar el equipo → entrada de incidencia a taller.
 * - "unresolved": se cierra sin resolución.
 * Al cerrar (in situ o sin resolución) y haber equipo relacionado, se crea la
 * ficha de historial en el equipo.
 */
export const verify = mutation({
  args: {
    incidentId: v.id("incidents"),
    // «onsite» no es un estado: es dónde acaba el paso. Los otros dos sí —el
    // cierre deja la incidencia en ellos tal cual—, así que se nombran por su
    // tabla.
    outcome: v.union(
      v.literal("onsite"),
      v.literal(INCIDENT_STATUSES.WORKSHOP),
      v.literal(INCIDENT_STATUSES.UNRESOLVED),
    ),
    equipmentId: v.optional(v.id("equipment")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.assigneeId !== actor._id &&
      incident.workshopAssigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico asignado o el coordinador pueden verificar esta incidencia.",
      );
    }
    // El paso se comprueba antes de nada: verificar solo se puede desde una
    // incidencia asignada o en reparación, y a dónde lleva cada uno lo dice la
    // máquina.
    if (!canAdvanceIncident(incident.status, VERIFY_STEPS[args.outcome])) {
      throw new ConvexError(
        "La incidencia debe estar asignada para verificarla.",
      );
    }
    // Verificar es el cierre del trabajo en el sitio. El estado «en reparación»
    // no dice dónde está el equipo —eso lo dice su entrada a taller abierta—, así
    // que con la orden abierta el trabajo se cierra desde ahí y no por aquí.
    if (isIncidentInWorkshop(incident)) {
      throw new ConvexError(
        "El equipo está en el taller: el trabajo se cierra desde la orden de taller.",
      );
    }
    if (args.equipmentId) {
      const equipment = await ctx.db.get(args.equipmentId);
      if (!equipment)
        throw new ConvexError("El equipo seleccionado ya no existe.");
    }

    const notes = richDocToStore(args.notes);
    const now = Date.now();
    const name = actorName(actor);

    if (args.outcome === INCIDENT_STATUSES.WORKSHOP) {
      const workshopStatus = incidentStepStatus("verifyWorkshop");
      await ctx.db.patch(args.incidentId, {
        status: workshopStatus,
        workshopAssigneeId: actor._id,
        workshopAssigneeName: name,
        ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
        updatedAt: now,
        history: [
          ...incident.history,
          historyEntry(
            workshopStatus,
            now,
            name,
            notes ? `Derivada a taller · ${notes}` : "Derivada a taller",
          ),
        ],
      });
      await notifyUsers(
        ctx,
        [
          ...(await moderatorIds(ctx)),
          ...(incident.assigneeId ? [incident.assigneeId] : []),
        ],
        `${incident.reference} derivada a taller (${name})`,
        incident._id,
        actor._id,
      );
      await scheduleReporterEmail(ctx, incident, workshopStatus);
      return;
    }

    // Cierre in situ o sin resolución: se crea la ficha si hay equipo. El estado
    // lo trae el paso correspondiente, no una cuenta a mano.
    const status = incidentStepStatus(
      args.outcome === "onsite" ? "verifyOnsite" : "verifyUnresolved",
    );
    const equipmentId = args.equipmentId ?? incident.equipmentId;
    const maintenanceId = equipmentId
      ? await createHistorySheet(ctx, {
          incident,
          equipmentId,
          status,
          notes,
          technician: name,
          closedAt: now,
        })
      : undefined;

    await ctx.db.patch(args.incidentId, {
      status,
      ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
      ...(notes ? { notes } : {}),
      closedAt: now,
      ...(maintenanceId ? { maintenanceId } : {}),
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          status,
          now,
          name,
          args.outcome === "onsite"
            ? notes
              ? `Resuelta in situ · ${notes}`
              : "Resuelta in situ"
            : notes
              ? `Cerrada sin resolución · ${notes}`
              : "Cerrada sin resolución",
        ),
      ],
    });

    const label =
      status === INCIDENT_STATUSES.RESOLVED ? "resuelta" : "sin resolución";
    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
      ],
      `${incident.reference} cerrada ${label} por ${name}`,
      incident._id,
      actor._id,
    );
    await scheduleReporterEmail(ctx, incident, status);
    await scheduleStaffEmail(ctx, incident, status);
  },
});

/**
 * Cambiar el técnico de la entrada a taller: el coordinador —o el técnico que la
 * lleva— la pasa al mismo u otro técnico, con el equipo en el taller. No mueve el
 * caso: sigue en taller, esperando material o reparándose, y solo cambia quién lo
 * lleva.
 */
export const assignWorkshop = mutation({
  args: {
    incidentId: v.id("incidents"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (!canCoordinate && incident.workshopAssigneeId !== actor._id) {
      throw new ConvexError(
        "Solo el coordinador o el técnico de la orden pueden reasignar la entrada a taller.",
      );
    }
    // Cambiar el técnico de taller no mueve el caso: vale con el equipo en el
    // taller —derivado, esperando material o ya reparándose— y la incidencia se
    // queda en el estado en el que está. El estado no dice dónde está el equipo,
    // así que una espera o una reparación en el sitio no tienen orden que
    // reasignar y se rechazan aquí, como el cierre en el sitio desde taller.
    if (!canAdvanceIncident(incident.status, "reassignWorkshop")) {
      throw new ConvexError(
        "La incidencia no está en taller, ni esperando repuestos, ni en reparación: no hay orden de taller que reasignar.",
      );
    }
    if (!isIncidentInWorkshop(incident)) {
      throw new ConvexError(
        "El equipo no está en el taller: no hay orden de taller que reasignar.",
      );
    }
    const assignee = await ctx.db.get(args.assigneeId);
    if (!assignee)
      throw new ConvexError("El técnico seleccionado ya no existe.");

    const now = Date.now();
    const assigneeName = actorName(assignee);
    await ctx.db.patch(args.incidentId, {
      workshopAssigneeId: assignee._id,
      workshopAssigneeName: assigneeName,
      updatedAt: now,
      history: [
        ...incident.history,
        // El rastro queda con el estado en el que está el caso —esperando
        // material, reparándose o en taller—, no con «en taller» de prestado: el
        // paso cambia quién lo lleva, no dónde está.
        historyEntry(
          incident.status,
          now,
          actorName(actor),
          `Orden de taller asignada a ${assigneeName}`,
        ),
      ],
    });
    await notifyUsers(
      ctx,
      [assignee._id],
      `Orden de taller de ${incident.reference} asignada a ti`,
      incident._id,
      actor._id,
    );
  },
});

/**
 * Cierre de la entrada de taller: resuelta o sin resolución, con los datos
 * del técnico. Si hay equipo relacionado se crea la ficha de historial.
 */
export const close = mutation({
  args: {
    incidentId: v.id("incidents"),
    outcome: v.union(
      v.literal(INCIDENT_STATUSES.RESOLVED),
      v.literal(INCIDENT_STATUSES.UNRESOLVED),
    ),
    equipmentId: v.optional(v.id("equipment")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.workshopAssigneeId !== actor._id &&
      incident.assigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico de la orden o el coordinador pueden cerrar esta incidencia.",
      );
    }
    const closed = requireIncidentStep(
      incident,
      args.outcome === INCIDENT_STATUSES.RESOLVED
        ? "closeResolved"
        : "closeUnresolved",
      () => "La incidencia no tiene una entrada de taller abierta.",
    );
    // Cerrar el trabajo de taller pide una orden abierta (salvo si viene de
    // reparación externa, que puede cerrarse directamente al recibir el dictamen).
    if (
      !isIncidentInWorkshop(incident) &&
      incident.status !== INCIDENT_STATUSES.EXTERNAL_REPAIR
    ) {
      throw new ConvexError(
        "La incidencia no tiene una entrada de taller abierta: su cierre es la verificación en el sitio.",
      );
    }
    if (args.equipmentId) {
      const equipment = await ctx.db.get(args.equipmentId);
      if (!equipment)
        throw new ConvexError("El equipo seleccionado ya no existe.");
    }

    const notes = richDocToStore(args.notes);
    const now = Date.now();
    const name = actorName(actor);
    const status = closed;
    const equipmentId = args.equipmentId ?? incident.equipmentId;
    const maintenanceId = equipmentId
      ? await createHistorySheet(ctx, {
          incident,
          equipmentId,
          status,
          notes,
          technician: name,
          closedAt: now,
        })
      : undefined;

    await ctx.db.patch(args.incidentId, {
      status,
      ...(args.equipmentId ? { equipmentId: args.equipmentId } : {}),
      ...(notes ? { notes } : {}),
      closedAt: now,
      ...(maintenanceId ? { maintenanceId } : {}),
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          status,
          now,
          name,
          notes
            ? `Trabajo en taller finalizado · ${notes}`
            : "Trabajo en taller finalizado",
        ),
      ],
    });

    const label =
      status === INCIDENT_STATUSES.RESOLVED ? "resuelta" : "sin resolución";
    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
        ...(incident.workshopAssigneeId ? [incident.workshopAssigneeId] : []),
      ],
      `${incident.reference} cerrada ${label} por ${name}`,
      incident._id,
      actor._id,
    );
    await scheduleReporterEmail(ctx, incident, status);
    await scheduleStaffEmail(ctx, incident, status);
  },
});

/**
 * Enviar el equipo a reparación a una empresa o servicio técnico externo:
 * cuando la avería no es reparable en el taller interno.
 */
export const sendToExternalRepair = mutation({
  args: {
    incidentId: v.id("incidents"),
    companyName: v.string(),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    defectNotes: v.string(),
    dispatchNotes: v.optional(v.string()),
    includedAccessories: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.workshopAssigneeId !== actor._id &&
      incident.assigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico asignado, el técnico de taller o el coordinador pueden enviar el equipo a reparación externa.",
      );
    }

    const nextStatus = requireIncidentStep(
      incident,
      "sendExternal",
      () =>
        "La incidencia no se puede enviar a reparación externa desde su estado actual.",
    );

    const now = Date.now();
    const name = actorName(actor);

    // Instantánea del equipo al enviarse
    let equipmentSnapshot = {
      name: incident.equipmentKind ?? "Equipo",
      model: incident.model ?? "Sin modelo",
      brand: undefined as string | undefined,
      serialNumber: incident.serialNumber,
      code: undefined as string | undefined,
      includedAccessories: args.includedAccessories?.trim() || undefined,
    };

    if (incident.equipmentId) {
      const eq = await ctx.db.get(incident.equipmentId);
      if (eq) {
        equipmentSnapshot = {
          name: eq.name,
          model: eq.model,
          brand: eq.brand,
          serialNumber: eq.serialNumber ?? incident.serialNumber,
          code: eq.code,
          includedAccessories: args.includedAccessories?.trim() || undefined,
        };
      }
    }

    const companyName = args.companyName.trim();
    if (!companyName) {
      throw new ConvexError("Indica el nombre de la empresa externa o SAT.");
    }
    const defectNotes = richDocToStore(args.defectNotes) ?? args.defectNotes.trim();
    const dispatchNotes = args.dispatchNotes?.trim() || undefined;

    await ctx.db.patch(args.incidentId, {
      status: nextStatus,
      updatedAt: now,
      externalRepair: {
        sentAt: now,
        companyName,
        contactName: args.contactName?.trim() || undefined,
        contactPhone: args.contactPhone?.trim() || undefined,
        defectNotes,
        dispatchNotes,
        sentById: actor._id,
        sentByName: name,
        equipmentSnapshot,
      },
      history: [
        ...incident.history,
        historyEntry(
          nextStatus,
          now,
          name,
          `Enviado a reparación externa · ${companyName}`,
        ),
      ],
    });

    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
        ...(incident.workshopAssigneeId ? [incident.workshopAssigneeId] : []),
      ],
      `${incident.reference} enviada a reparación externa (${companyName}) por ${name}`,
      incident._id,
      actor._id,
    );

    await scheduleReporterEmail(ctx, incident, nextStatus);
  },
});

/**
 * Registrar el retorno del equipo desde la empresa externa de vuelta al taller.
 */
export const receiveFromExternalRepair = mutation({
  args: {
    incidentId: v.id("incidents"),
    repairNotes: v.optional(v.string()),
    workshopNotes: v.optional(v.string()),
    cost: v.optional(v.number()),
    deliveryNoteNumber: v.optional(v.string()),
    deliveryNoteStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    const canCoordinate = await hasCapability(ctx, actor, "manageIncidents");
    if (
      !canCoordinate &&
      incident.workshopAssigneeId !== actor._id &&
      incident.assigneeId !== actor._id
    ) {
      throw new ConvexError(
        "Solo el técnico asignado, el técnico de taller o el coordinador pueden registrar la recepción de la reparación externa.",
      );
    }

    const nextStatus = requireIncidentStep(
      incident,
      "returnExternal",
      () => "La incidencia no está en reparación externa.",
    );

    if (!incident.externalRepair) {
      throw new ConvexError(
        "La incidencia no tiene datos de envío a reparación externa.",
      );
    }

    const now = Date.now();
    const name = actorName(actor);
    const repairNotes = args.repairNotes?.trim() || undefined;
    const workshopNotes = args.workshopNotes?.trim() || undefined;

    await ctx.db.patch(args.incidentId, {
      status: nextStatus,
      updatedAt: now,
      externalRepair: {
        ...incident.externalRepair,
        receivedAt: now,
        receivedById: actor._id,
        receivedByName: name,
        repairNotes,
        workshopNotes,
        cost: args.cost,
        deliveryNoteNumber: args.deliveryNoteNumber?.trim() || undefined,
        deliveryNoteStorageId: args.deliveryNoteStorageId,
      },
      history: [
        ...incident.history,
        historyEntry(
          nextStatus,
          now,
          name,
          `Recibido de reparación externa (${incident.externalRepair.companyName})`,
        ),
      ],
    });

    await notifyUsers(
      ctx,
      [
        ...(await moderatorIds(ctx)),
        ...(incident.assigneeId ? [incident.assigneeId] : []),
        ...(incident.workshopAssigneeId ? [incident.workshopAssigneeId] : []),
      ],
      `${incident.reference} recibida de reparación externa por ${name}`,
      incident._id,
      actor._id,
    );

    await scheduleReporterEmail(ctx, incident, nextStatus);
  },
});

/* ------------------------------------------------------------------ */
/* Datos del equipo: corregir lo que se notificó mal o a medias         */
/* ------------------------------------------------------------------ */

/**
 * Corrige el modelo y el nº de serie del equipo de una incidencia. Quien la
 * notifica no tiene el equipo delante y lo describe de memoria: a veces se
 * equivoca y a veces deja el nº de serie en blanco. Quien sí lo tiene delante
 * —el técnico que la lleva o quien coordina— es el único que puede ponerlos
 * bien, y son justo los dos datos que identifican la máquina en la ficha de
 * historial y con los que se compone su intervención.
 *
 * Vale para cualquier estado: el dato es del equipo, no de un paso del flujo, y
 * corregirlo después de cerrar sigue valiendo para el historial de la máquina
 * (que se compone con estos mismos campos). Deja su traza en la ficha, como los
 * demás pasos, diciendo qué cambió.
 *
 * Un campo sin enviar se deja como está, y enviarlo en blanco es quitarlo —así
 * se corrige el dato que era erróneo, y no por descuido al mandar solo uno de
 * los dos—. El modelo, en cambio, no puede quedarse vacío: es lo que identifica
 * la máquina en su historial, y el formulario de notificación tampoco lo admite
 * en blanco.
 */
export const updateEquipment = mutation({
  args: {
    incidentId: v.id("incidents"),
    equipmentId: v.optional(v.id("equipment")),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const incident = await getIncident(ctx, args.incidentId);
    await requireEquipmentEditor(ctx, actor, incident);

    const equipmentId = args.equipmentId ?? incident.equipmentId;
    let linkedEq = null;
    if (args.equipmentId) {
      linkedEq = await ctx.db.get(args.equipmentId);
      if (!linkedEq)
        throw new ConvexError(
          "El equipo seleccionado no existe en el inventario.",
        );
    }

    const model =
      args.model !== undefined
        ? args.model.trim() || undefined
        : linkedEq
          ? linkedEq.model.trim()
          : incident.model;
    if (model === undefined) {
      throw new ConvexError(
        "Escribe el modelo del equipo: es lo que identifica la máquina en su historial.",
      );
    }
    const serialNumber =
      args.serialNumber !== undefined
        ? args.serialNumber.trim() || undefined
        : linkedEq
          ? linkedEq.serialNumber?.trim() || undefined
          : incident.serialNumber;

    const sameEquipment = equipmentId === incident.equipmentId;
    const sameModel = model === incident.model;
    const sameSerial = serialNumber === incident.serialNumber;
    if (sameEquipment && sameModel && sameSerial) {
      throw new ConvexError(
        "Esos son los datos que ya tiene la incidencia: no hay cambios que guardar.",
      );
    }

    const now = Date.now();
    const name = actorName(actor);
    // El rastro dice qué cambió, no solo que cambió: es lo que permite leer la
    // ficha de un vistazo y saber de dónde salió el dato que hay ahora.
    const changes = [
      ...(args.equipmentId && args.equipmentId !== incident.equipmentId
        ? [`vinculado a ${linkedEq?.code ?? linkedEq?.model ?? "inventario"}`]
        : []),
      ...(model !== incident.model ? [`modelo ${model}`] : []),
      ...(serialNumber !== incident.serialNumber
        ? [serialNumber ? `nº de serie ${serialNumber}` : "sin nº de serie"]
        : []),
    ];

    await ctx.db.patch(args.incidentId, {
      ...(equipmentId ? { equipmentId } : {}),
      model,
      serialNumber,
      updatedAt: now,
      history: [
        ...incident.history,
        historyEntry(
          incident.status,
          now,
          name,
          `Datos del equipo actualizados · ${changes.join(" · ")}`,
        ),
      ],
    });
  },
});

/* ------------------------------------------------------------------ */
/* Archivo: sacar del día a día lo cerrado y antiguo, sin perderlo      */
/* ------------------------------------------------------------------ */

/* La máquina del ciclo de vida («¿desde aquí se puede dar este paso?») vive en
 * `lib/incidentFlow`, compartida con los botones de la ficha. Aquí solo queda el
 * aviso, que es cosa de quien lo intenta. */

async function createHistorySheet(
  ctx: MutationCtx,
  args: {
    incident: Doc<"incidents">;
    equipmentId: Id<"equipment">;
    /** Las dos únicas salidas de una incidencia: las de su tabla de estados. */
    status: (typeof INCIDENT_STATUSES)["RESOLVED" | "UNRESOLVED"];
    notes?: string;
    technician: string;
    closedAt: number;
  },
): Promise<Id<"maintenanceRecords">> {
  const { incident } = args;
  // Lo retirado no se cita: una petición que está en la papelera es la que se
  // pidió por error o se duplicó, así que el historial del equipo no la cuenta
  // como el material que se puso.
  const linkedRequest = await ctx.db
    .query("partRequests")
    .withIndex("by_incident", (q) => q.eq("incidentId", incident._id))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .first();

  const reported = new Date(incident.reportedAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const closed = new Date(args.closedAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const lines = [
    `Incidencia ${incident.reference}: notificada por ${incident.reporterName}${
      incident.reporterRole ? ` (${incident.reporterRole})` : ""
    } el ${reported}${incident.location ? ` en ${incident.location}` : ""}.`,
    `Equipo: ${incident.equipmentKind} ${incident.model}${
      incident.serialNumber ? ` · S/N ${incident.serialNumber}` : ""
    }.`,
    `Avería descrita: ${richDocToPlainText(incident.description)}`,
    args.notes ? `Notas del técnico: ${args.notes}` : "",
    incident.externalRepair
      ? `Reparación externa: ${incident.externalRepair.companyName}${
          incident.externalRepair.repairNotes
            ? ` · ${incident.externalRepair.repairNotes}`
            : ""
        }${
          incident.externalRepair.cost !== undefined
            ? ` · Coste: ${incident.externalRepair.cost} €`
            : ""
        }.`
      : "",
    `Cierre: ${
      args.status === INCIDENT_STATUSES.RESOLVED ? "resuelta" : "sin resolución"
    } por ${args.technician} el ${closed}.`,
    linkedRequest ? `Material: petición ${linkedRequest.reference}.` : "",
  ].filter(Boolean);

  return await ctx.db.insert("maintenanceRecords", {
    equipmentId: args.equipmentId,
    kind: "repair",
    title: `Incidencia ${incident.reference}`,
    description: lines.join("\n"),
    performedAt: args.closedAt,
    technician: args.technician,
    ...(linkedRequest ? { requestId: linkedRequest._id } : {}),
    createdAt: args.closedAt,
    updatedAt: args.closedAt,
  });
}

/** El paso, o el aviso de por qué no se puede dar desde donde está. */
function requireIncidentStep<A extends IncidentAction>(
  incident: Doc<"incidents">,
  action: A,
  blocked: () => string,
): IncidentStepStatus<A> {
  if (!canAdvanceIncident(incident.status, action)) {
    throw new ConvexError(blocked());
  }
  return incidentStepStatus(action);
}

/* ------------------------------------------------------------------ */
/* Re-exportaciones de sub-módulos CQS (notas, documentos, papelera)  */
/* ------------------------------------------------------------------ */

export {
  addNote,
  updateNote,
  restoreNoteVersion,
  removeNote,
  restoreNote,
} from "./_incidents/notes";

export {
  generateUploadUrl,
  attachDocument,
  updateDocument,
  removeDocument,
  documentTrail,
  documentTrails,
  documentAudit,
} from "./_incidents/documents";

export {
  archive,
  unarchive,
  archiveClosedBefore,
  withdraw,
  restore,
  deleteNow,
  purgeExpired,
  trash,
  withdrawn,
  type WithdrawnIncidentItem,
} from "./_incidents/trash";

export const statusValidator = incidentStatusValidator;
