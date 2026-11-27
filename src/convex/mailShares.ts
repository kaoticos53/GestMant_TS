import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { logSecurityEvent } from "./audit";
import { readAccount, requireMailboxMember } from "./mailAccounts";
import type { Capability } from "../lib/permissions";
import { hasCapability, memberOrNull, requireAdmin } from "./permissions";
import { resolveDestination } from "./_mailShares/destinations";
import { wipeShareContent } from "./_mailShares/purge";
import { INCIDENT_STATUSES } from "./schema";
import { freeReference } from "./references";
import { safeSlice } from "../lib/text";
import {
  BODY_HTML_MAX_CHARS,
  BODY_TEXT_MAX_CHARS,
  DESTINATION_AUDIENCE,
  DESTINATION_LABELS,
  SHARE_CAPABILITY,
  buildShareSummary,
  canReadSharedMail,
  fitsShareLimit,
  orphanPurgeAt,
  resolveShareMode,
  shareSnapshotBytes,
  truncateShareText,
  type MailShareDestinationType,
  type MailShareMode,
} from "../lib/mailShare";

const destinationTypeValidator = v.union(
  v.literal("incident"),
  v.literal("request"),
  v.literal("equipment"),
  v.literal("manual"),
  v.literal("purchaseOrder"),
  v.literal("purchaseRequest"),
);

const modeValidator = v.union(v.literal("summary"), v.literal("original"));

/** Capacidades que deciden quién ve una copia, además de las de compartir. */
const AUDIENCE_CAPABILITIES = new Set([
  ...Object.values(SHARE_CAPABILITY),
  ...DESTINATION_AUDIENCE.equipment,
  ...DESTINATION_AUDIENCE.manual,
  ...DESTINATION_AUDIENCE.purchaseOrder,
]);

/** El mensaje propio que se va a compartir, ya autorizado a leerse. */
interface MailboxMessage {
  user: Doc<"users">;
  email: string;
  header: Doc<"mailHeaders">;
}

interface MailboxActor extends MailboxMessage {
  userName: string;
}

interface ShareContext extends MailboxActor {
  destinationReference: string;
}

/**
 * La sesión con buzón y el mensaje propio —cabecera viva, cuenta del taller— o
 * el aviso que corresponda. Lo comparten compartir y el alta desde correo: las
 * dos puertas piden lo mismo y solo se diferencian en la capacidad y el destino.
 */
async function requireMailboxActor(
  ctx: QueryCtx,
  messageId: string,
): Promise<MailboxActor> {
  const user = await requireMailboxMember(ctx);
  const account = await readAccount(ctx, user._id);
  if (!account) throw new ConvexError("Todavía no has configurado tu buzón.");

  const header = await ctx.db
    .query("mailHeaders")
    .withIndex("by_user_message", (q) =>
      q
        .eq("userId", user._id)
        .eq("accountId", account._id)
        .eq("messageId", messageId),
    )
    .first();
  if (!header || header.deletedRemoteAt !== undefined) {
    throw new ConvexError("Ese mensaje no pertenece a tu buzón.");
  }

  return {
    user,
    email: account.email,
    header,
    userName: user.name?.trim() || user.email?.trim() || "Miembro del taller",
  };
}

/**
 * Comprueba identidad, mensaje propio, destino vivo, capacidad y modo antes de
 * tocar red o almacenamiento. Una acción no lee la base de datos, así que todo
 * esto vive en una consulta interna.
 */
export const shareContext = internalQuery({
  args: {
    messageId: v.string(),
    destinationType: destinationTypeValidator,
    destinationId: v.string(),
    mode: modeValidator,
  },
  handler: async (ctx, args): Promise<ShareContext> => {
    // La puerta del buzón ya exige sesión de taller y `viewMailbox`, que es
    // justo lo que pide compartir: no hay una segunda comprobación que hacer.
    const base = await requireMailboxActor(ctx, args.messageId);

    const destination = await resolveDestination(
      ctx,
      args.destinationType,
      args.destinationId,
    );
    if (destination.deleted) {
      throw new ConvexError(
        `${DESTINATION_LABELS[args.destinationType]} está en la papelera: restáurala antes de compartir correo.`,
      );
    }

    if (
      !(await hasCapability(
        ctx,
        base.user,
        SHARE_CAPABILITY[args.destinationType],
      ))
    ) {
      throw new ConvexError(
        `Tu rol no puede adjuntar correo a ${DESTINATION_LABELS[args.destinationType].toLowerCase()}.`,
      );
    }

    const mode = resolveShareMode(args.destinationType, args.mode);
    if (!mode.ok) throw new ConvexError(mode.error);

    return { ...base, destinationReference: destination.reference };
  },
});

interface CachedShareContent {
  text: string;
  html: string | null;
  attachments: StoredAttachment[];
}

/**
 * Contenido ya cacheado del mensaje. La copia lo lee y copia sus adjuntos a
 * objetos propios; no escribe en `mailBodies` ni en `mailAttachments` ni mueve
 * los contadores de la caché.
 */
export const cachedForShare = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, args): Promise<CachedShareContent | null> => {
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) return null;
    const body = await ctx.db
      .query("mailBodies")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("accountId", account._id)
          .eq("messageId", args.messageId),
      )
      .first();
    if (!body) return null;
    const attachments = await ctx.db
      .query("mailAttachments")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("accountId", account._id)
          .eq("messageId", args.messageId),
      )
      .collect();
    return {
      text: body.text,
      html: body.html ?? null,
      attachments: attachments
        .filter((row) => row.filename !== undefined)
        .map((row) => ({
          storageId: row.storageId,
          name: row.filename ?? "Adjunto",
          contentType: row.contentType,
          size: row.size,
        })),
    };
  },
});

/** Un adjunto ya copiado a un objeto propio de la copia. */
interface StoredAttachment {
  storageId: Id<"_storage">;
  name: string;
  contentType: string;
  size: number;
}

const storedAttachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});

/**
 * Los campos de la instantánea, iguales para una copia a una ficha y para el
 * alta que crea la suya. Lo que cambia —el destino, o la descripción— va aparte.
 */
const snapshotArgs = {
  sourceMessageId: v.string(),
  sourceEmail: v.string(),
  mode: modeValidator,
  subject: v.string(),
  fromName: v.string(),
  fromAddress: v.string(),
  sentAt: v.number(),
  summary: v.string(),
  bodyText: v.optional(v.string()),
  bodyHtml: v.optional(v.string()),
  bodyTruncated: v.optional(v.boolean()),
  attachments: v.optional(v.array(storedAttachmentValidator)),
  sharedBy: v.id("users"),
  sharedByName: v.string(),
  clientShareId: v.optional(v.string()),
};

/** La copia no puede pasar de 50 MB: el límite protege el almacén y la ficha. */
function assertShareFits(args: {
  bodyText?: string;
  bodyHtml?: string;
  attachments?: StoredAttachment[];
}): void {
  const bytes = shareSnapshotBytes({
    bodyText: new TextEncoder().encode(args.bodyText ?? "").length,
    bodyHtml: new TextEncoder().encode(args.bodyHtml ?? "").length,
    attachments: (args.attachments ?? []).reduce(
      (sum, attachment) => sum + attachment.size,
      0,
    ),
    eml: 0,
  });
  if (!fitsShareLimit(bytes)) {
    throw new ConvexError(
      "La copia supera el límite de 50 MB del correo: compártela en modo resumen.",
    );
  }
}

/**
 * Guarda la copia ya materializada. Idempotente por `clientShareId`: un
 * reintento devuelve la copia existente en vez de duplicarla.
 */
export const persistShare = internalMutation({
  args: {
    destinationType: destinationTypeValidator,
    destinationId: v.string(),
    destinationReference: v.string(),
    ...snapshotArgs,
  },
  handler: async (ctx, args): Promise<Id<"mailShares">> => {
    if (args.clientShareId) {
      // El índice solo sabe de autor y marca: el mismo `clientShareId` puede
      // haberse usado para otra ficha, y entonces no es un reintento sino otra
      // copia. Se reutiliza únicamente la que apunta al destino esperado.
      const rows = await ctx.db
        .query("mailShares")
        .withIndex("by_client_share", (q) =>
          q
            .eq("sharedBy", args.sharedBy)
            .eq("clientShareId", args.clientShareId),
        )
        .collect();
      const same = rows.find(
        (row) =>
          row.destinationType === args.destinationType &&
          row.destinationId === args.destinationId,
      );
      if (same) return same._id;
    }

    assertShareFits(args);

    return await ctx.db.insert("mailShares", {
      sourceMessageId: args.sourceMessageId,
      sourceEmail: args.sourceEmail,
      destinationType: args.destinationType,
      // El validador del esquema es la unión de ids de los seis destinos; el
      // tipo concreto ya lo ha comprobado `resolveDestination`.
      destinationId: args.destinationId as Id<"incidents">,
      destinationReference: args.destinationReference,
      mode: args.mode,
      subject: args.subject,
      fromName: args.fromName,
      fromAddress: args.fromAddress,
      sentAt: args.sentAt,
      summary: args.summary,
      bodyText: args.bodyText,
      bodyHtml: args.bodyHtml,
      bodyTruncated: args.bodyTruncated,
      attachments: args.attachments,
      sharedBy: args.sharedBy,
      sharedByName: args.sharedByName,
      sharedAt: Date.now(),
      clientShareId: args.clientShareId,
    });
  },
});

/** Traza de la compartición: ids y destino, nunca asunto, remitente ni cuerpo. */
export const auditShare = internalMutation({
  args: { shareId: v.id("mailShares") },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) return;
    await logSecurityEvent(ctx, {
      actorId: share.sharedBy,
      action: "mail_share_create",
      target: `${share.destinationType}:${share.destinationReference ?? ""}`,
      metadata: { shareId: args.shareId, mode: share.mode },
    });
  },
});

/**
 * Copia los adjuntos cacheados a objetos propios de una copia. Devuelve lo que
 * hay que guardar en la fila y los ids escritos, para poder limpiarlos si algo
 * falla después.
 */
async function copyCachedAttachments(
  ctx: ActionCtx,
  cached: CachedShareContent | null,
  mode: MailShareMode,
): Promise<{
  attachments: StoredAttachment[] | undefined;
  copied: Id<"_storage">[];
}> {
  if (mode !== "original" || !cached) {
    return { attachments: undefined, copied: [] };
  }
  const copied: Id<"_storage">[] = [];
  const attachments: StoredAttachment[] = [];
  for (const attachment of cached.attachments) {
    const url = await ctx.storage.getUrl(attachment.storageId);
    if (url === null) {
      throw new ConvexError(
        `El adjunto «${attachment.name}» ya no está disponible; vuelve a abrir el mensaje.`,
      );
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new ConvexError(
        `No se pudo copiar el adjunto «${attachment.name}».`,
      );
    }
    const storageId = await ctx.storage.store(
      new Blob([await response.arrayBuffer()], {
        type: attachment.contentType,
      }),
    );
    copied.push(storageId);
    attachments.push({
      storageId,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
    });
  }
  return { attachments, copied };
}

/**
 * Lo que se guarda de un mensaje, ya recortado, según el modo.
 *
 * En `summary` solo va el extracto: ni cuerpo ni adjuntos. En `original` van
 * el texto y el HTML recortados a sus límites, y la marca de que hubo recorte.
 */
function buildShareSnapshot(
  cached: CachedShareContent | null,
  header: Doc<"mailHeaders">,
  mode: MailShareMode,
): {
  summary: string;
  bodyText?: string;
  bodyHtml?: string;
  bodyTruncated?: boolean;
} {
  const summary = buildShareSummary(
    cached?.text ?? header.snippet,
    header.subject,
  );
  if (mode !== "original") return { summary };

  const text = truncateShareText(cached?.text ?? "", BODY_TEXT_MAX_CHARS);
  const html = cached?.html
    ? truncateShareText(cached.html, BODY_HTML_MAX_CHARS)
    : null;
  return {
    summary,
    bodyText: text.value,
    bodyHtml: html?.value ?? undefined,
    bodyTruncated: text.truncated || (html?.truncated ?? false),
  };
}

/** El modo original exige el mensaje ya abierto: compartir no descarga. */
function requireCachedForOriginal(
  cached: CachedShareContent | null,
  mode: MailShareMode,
  action: string,
): void {
  if (mode === "original" && !cached) {
    throw new ConvexError(
      `Abre el mensaje antes de ${action} en modo original: su contenido aún no se ha descargado.`,
    );
  }
}

/** Borra los objetos de una llamada que no llegó a dejar su cita. */
async function deleteObjects(
  ctx: ActionCtx,
  storageIds: Id<"_storage">[],
): Promise<void> {
  for (const storageId of storageIds) {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      // El barrido nocturno de `storageCleanup` lo recoge igual.
    }
  }
}

/**
 * Comparte un mensaje del buzón propio con una ficha del taller.
 *
 * El contenido sale de la caché del buzón —abrir el mensaje es el paso previo
 * del visor— y sus adjuntos se copian a objetos propios de la copia. Si el
 * mensaje aún no se ha abierto y se pide el original, se pide abrirlo antes de
 * descargarlo aquí: compartir no escribe en la caché.
 */
export const share = action({
  args: {
    messageId: v.string(),
    destinationType: destinationTypeValidator,
    destinationId: v.string(),
    mode: modeValidator,
    clientShareId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ shareId: Id<"mailShares"> }> => {
    const base = await ctx.runQuery(internal.mailShares.shareContext, {
      messageId: args.messageId,
      destinationType: args.destinationType,
      destinationId: args.destinationId,
      mode: args.mode,
    });
    const cached = await ctx.runQuery(internal.mailShares.cachedForShare, {
      messageId: args.messageId,
    });
    requireCachedForOriginal(cached, args.mode, "compartirlo");

    let copied: Id<"_storage">[] = [];
    try {
      const materialized = await copyCachedAttachments(ctx, cached, args.mode);
      copied = materialized.copied;

      const shareId = await ctx.runMutation(internal.mailShares.persistShare, {
        sourceMessageId: base.header.messageId,
        sourceEmail: base.email,
        destinationType: args.destinationType,
        destinationId: args.destinationId,
        destinationReference: base.destinationReference,
        mode: args.mode,
        subject: base.header.subject,
        fromName: base.header.fromName,
        fromAddress: base.header.fromAddress,
        sentAt: base.header.date,
        ...buildShareSnapshot(cached, base.header, args.mode),
        attachments: materialized.attachments,
        sharedBy: base.user._id,
        sharedByName: base.userName,
        clientShareId: args.clientShareId,
      });

      await ctx.runMutation(internal.mailShares.auditShare, { shareId });
      return { shareId };
    } catch (error) {
      await deleteObjects(ctx, copied);
      throw error;
    }
  },
});

/** El contexto de un alta desde correo: sesión, capacidad y mensaje propio. */
export const incidentMailContext = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, args): Promise<MailboxActor> => {
    const base = await requireMailboxActor(ctx, args.messageId);
    if (!(await hasCapability(ctx, base.user, "createIncidentFromMail"))) {
      throw new ConvexError(
        "Tu rol no puede crear incidencias desde el correo. Pídeselo al administrador.",
      );
    }
    return base;
  },
});

/**
 * Alta atómica de la incidencia y su copia.
 *
 * Las dos filas se escriben en la misma mutación: si la copia no cabe en el
 * límite o la inserción falla, la incidencia no llega a existir. La referencia
 * la reparte `convex/references`, la misma serie que el resto de altas, y el
 * historial deja constancia de que nació de un correo.
 */
export const createIncidentWithShare = internalMutation({
  args: {
    ...snapshotArgs,
    description: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    incidentId: Id<"incidents">;
    shareId: Id<"mailShares">;
    reference: string;
    created: boolean;
  }> => {
    if (args.clientShareId) {
      // Solo vale una copia que creó su incidencia: compartir el mismo correo
      // con una incidencia que ya existía también apunta a una incidencia, pero
      // no es el alta que este reintento busca.
      const rows = await ctx.db
        .query("mailShares")
        .withIndex("by_client_share", (q) =>
          q
            .eq("sharedBy", args.sharedBy)
            .eq("clientShareId", args.clientShareId),
        )
        .collect();
      const existing = rows.find(
        (row) =>
          row.destinationType === "incident" && row.createdDestination === true,
      );
      if (existing) {
        return {
          incidentId: existing.destinationId as Id<"incidents">,
          shareId: existing._id,
          reference: existing.destinationReference ?? "",
          created: false,
        };
      }
    }

    assertShareFits(args);

    const now = Date.now();
    const reference = await freeReference(ctx, "incident");
    const incidentId = await ctx.db.insert("incidents", {
      reference,
      reporterName: args.fromName.trim() || args.fromAddress,
      reporterEmail: args.fromAddress,
      description: args.description,
      reportedAt: now,
      status: INCIDENT_STATUSES.REPORTED,
      history: [
        {
          status: INCIDENT_STATUSES.REPORTED,
          at: now,
          by: args.sharedByName,
          note: "Creada desde correo",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const shareId = await ctx.db.insert("mailShares", {
      sourceMessageId: args.sourceMessageId,
      sourceEmail: args.sourceEmail,
      destinationType: "incident",
      destinationId: incidentId,
      destinationReference: reference,
      mode: args.mode,
      subject: args.subject,
      fromName: args.fromName,
      fromAddress: args.fromAddress,
      sentAt: args.sentAt,
      summary: args.summary,
      bodyText: args.bodyText,
      bodyHtml: args.bodyHtml,
      bodyTruncated: args.bodyTruncated,
      attachments: args.attachments,
      sharedBy: args.sharedBy,
      sharedByName: args.sharedByName,
      sharedAt: now,
      clientShareId: args.clientShareId,
      createdDestination: true,
    });
    return { incidentId, shareId, reference, created: true };
  },
});

/**
 * Crea una incidencia en `reported` desde un correo del buzón propio.
 *
 * El remitente del mensaje es el notificante y el técnico que comparte queda
 * como autor en el historial. La incidencia y la copia se escriben juntas: si
 * una falla, no queda la otra, y los adjuntos ya copiados se borran.
 */
export const createIncidentFromMail = action({
  args: {
    messageId: v.string(),
    mode: modeValidator,
    clientShareId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    incidentId: Id<"incidents">;
    shareId: Id<"mailShares">;
    reference: string;
  }> => {
    const base = await ctx.runQuery(internal.mailShares.incidentMailContext, {
      messageId: args.messageId,
    });
    const cached = await ctx.runQuery(internal.mailShares.cachedForShare, {
      messageId: args.messageId,
    });
    requireCachedForOriginal(cached, args.mode, "crear la incidencia");

    const snapshot = buildShareSnapshot(cached, base.header, args.mode);

    let copied: Id<"_storage">[] = [];
    try {
      const materialized = await copyCachedAttachments(ctx, cached, args.mode);
      copied = materialized.copied;

      const result = await ctx.runMutation(
        internal.mailShares.createIncidentWithShare,
        {
          sourceMessageId: base.header.messageId,
          sourceEmail: base.email,
          mode: args.mode,
          subject: base.header.subject,
          fromName: base.header.fromName,
          fromAddress: base.header.fromAddress,
          sentAt: base.header.date,
          ...snapshot,
          attachments: materialized.attachments,
          sharedBy: base.user._id,
          sharedByName: base.userName,
          clientShareId: args.clientShareId,
          description: safeSlice(
            `${base.header.subject}\n\n${snapshot.summary}`.trim(),
            4000,
          ),
        },
      );

      if (!result.created) {
        // Reintento idempotente: la incidencia ya existía, así que los objetos
        // copiados en esta llamada no los cita nadie.
        await deleteObjects(ctx, copied);
        return result;
      }

      await ctx.runMutation(internal.mailShares.auditShare, {
        shareId: result.shareId,
      });
      return result;
    } catch (error) {
      await deleteObjects(ctx, copied);
      throw error;
    }
  },
});

/** Permisos con los que se decide la audiencia de una copia. */
async function audienceGrants(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<Record<string, boolean>> {
  const grants: Record<string, boolean> = {};
  for (const capability of AUDIENCE_CAPABILITIES) {
    grants[capability] = await hasCapability(ctx, user, capability);
  }
  return grants;
}

/**
 * La persona de la sesión, si la audiencia del destino le deja ver la copia.
 * Incidencias y peticiones usan la audiencia de su ficha; el resto, la
 * capacidad de su módulo. Una copia huérfana solo la ve el administrador.
 */
async function audienceFor(
  ctx: QueryCtx,
  type: MailShareDestinationType,
  destinationId: string,
): Promise<Doc<"users"> | null> {
  const user = await memberOrNull(ctx);
  if (!user) return null;

  let inTrash = false;
  try {
    inTrash = (await resolveDestination(ctx, type, destinationId)).deleted;
  } catch {
    // El destino ya no existe: solo queda la papelera administrativa.
    return user.role === "admin" ? user : null;
  }

  const canRead = canReadSharedMail({
    destinationType: type,
    destinationInTrash: inTrash,
    isAdmin: user.role === "admin",
    active: user.active !== false,
    isAnonymous: user.isAnonymous === true,
    grants: await audienceGrants(ctx, user),
  });
  return canRead ? user : null;
}

/** Una fila de la sección «Correos compartidos». */
export interface MailShareSummaryRow {
  id: Id<"mailShares">;
  mode: MailShareMode;
  subject: string;
  fromName: string;
  fromAddress: string;
  sentAt: number;
  summary: string;
  sharedByName: string;
  sharedAt: number;
  purgedAt: number | null;
  /** Volvió de un backup: solo metadatos, sin cuerpo ni archivos. */
  backupRestored: boolean;
}

function summaryRow(row: Doc<"mailShares">): MailShareSummaryRow {
  const purged = row.contentPurgedAt !== undefined;
  return {
    id: row._id,
    mode: row.mode,
    subject: purged ? "" : (row.subject ?? ""),
    fromName: purged ? "" : (row.fromName ?? ""),
    fromAddress: purged ? "" : (row.fromAddress ?? ""),
    sentAt: row.sentAt,
    summary: purged ? "" : (row.summary ?? ""),
    sharedByName: row.sharedByName,
    sharedAt: row.sharedAt,
    purgedAt: row.contentPurgedAt ?? null,
    backupRestored: row.backupRestored === true,
  };
}

/** Copias visibles de una ficha; las lápidas van sin asunto ni remitente. */
export const listForDestination = query({
  args: {
    destinationType: destinationTypeValidator,
    destinationId: v.string(),
  },
  handler: async (ctx, args): Promise<MailShareSummaryRow[]> => {
    const user = await audienceFor(
      ctx,
      args.destinationType,
      args.destinationId,
    );
    if (!user) return [];
    const rows = await ctx.db
      .query("mailShares")
      .withIndex("by_destination", (q) =>
        q
          .eq("destinationType", args.destinationType)
          .eq("destinationId", args.destinationId as Id<"incidents">),
      )
      .collect();
    return rows.sort((a, b) => a.sharedAt - b.sharedAt).map(summaryRow);
  },
});

export interface MailShareDetail extends MailShareSummaryRow {
  bodyText: string | null;
  bodyHtml: string | null;
  bodyTruncated: boolean;
  attachments: { index: number; name: string; size: number }[];
  destinationType: MailShareDestinationType;
  destinationId: string;
  destinationReference: string;
}

export const get = query({
  args: { shareId: v.id("mailShares") },
  handler: async (ctx, args): Promise<MailShareDetail | null> => {
    const row = await ctx.db.get(args.shareId);
    if (!row) return null;
    const user = await audienceFor(ctx, row.destinationType, row.destinationId);
    if (!user) return null;
    const purged = row.contentPurgedAt !== undefined;
    return {
      ...summaryRow(row),
      bodyText: purged ? null : (row.bodyText ?? null),
      bodyHtml: purged ? null : (row.bodyHtml ?? null),
      bodyTruncated: row.bodyTruncated === true,
      attachments: (row.attachments ?? []).map((attachment, index) => ({
        index,
        name: attachment.name,
        size: attachment.size,
      })),
      destinationType: row.destinationType,
      destinationId: row.destinationId,
      destinationReference: row.destinationReference ?? "",
    };
  },
});

/**
 * URL de un adjunto de la copia. La audiencia del destino se comprueba antes
 * de devolver nada; nunca se entrega una URL a quien no ve la ficha.
 */
export const downloadAttachment = action({
  args: { shareId: v.id("mailShares"), index: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string; name: string; contentType: string }> => {
    const target = await ctx.runQuery(internal.mailShares.downloadContext, {
      shareId: args.shareId,
      index: args.index,
    });
    const url = await ctx.storage.getUrl(target.storageId);
    if (url === null) {
      throw new ConvexError("El archivo de la copia ya no está disponible.");
    }
    return { url, name: target.name, contentType: target.contentType };
  },
});

export const downloadContext = internalQuery({
  args: { shareId: v.id("mailShares"), index: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    storageId: Id<"_storage">;
    name: string;
    contentType: string;
  }> => {
    const row = await ctx.db.get(args.shareId);
    if (!row) throw new ConvexError("Esa copia ya no existe.");
    const user = await audienceFor(ctx, row.destinationType, row.destinationId);
    if (!user) throw new ConvexError("No puedes ver esa copia.");
    if (row.contentPurgedAt !== undefined) {
      throw new ConvexError("Esa copia ya no tiene contenido.");
    }
    const attachment = row.attachments?.[args.index];
    if (!attachment) {
      throw new ConvexError("Ese adjunto no existe en la copia.");
    }
    return {
      storageId: attachment.storageId,
      name: attachment.name,
      contentType: attachment.contentType,
    };
  },
});

/**
 * Purga de administrador: borra adjuntos y `.eml`, vacía el contenido y deja
 * la fila como lápida. No toca la caché, la cuenta ni el mensaje original.
 */
export const purge = mutation({
  args: { shareId: v.id("mailShares") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, "purgar una copia de correo");
    const row = await ctx.db.get(args.shareId);
    if (!row) throw new ConvexError("Esa copia ya no existe.");
    if (row.contentPurgedAt !== undefined) return true;

    await wipeShareContent(ctx, row, {
      reason: "manual",
      by: admin._id,
      now: Date.now(),
    });
    await logSecurityEvent(ctx, {
      actorId: admin._id,
      action: "mail_share_purge",
      target: `${row.destinationType}:${row.destinationReference ?? ""}`,
      metadata: { shareId: row._id, reason: "manual" },
    });
    return true;
  },
});

/** Un archivo descargable de una copia huérfana: el `.eml` o un adjunto. */
export interface OrphanMailShareFile {
  kind: "eml" | "attachment";
  /** Posición en `attachments`; `null` para el `.eml`. */
  index: number | null;
  name: string;
  size: number;
}

/** Una fila de la papelera administrativa de huérfanas. */
export interface OrphanMailShareRow {
  shareId: Id<"mailShares">;
  destinationType: MailShareDestinationType;
  destinationReference: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  mode: MailShareMode;
  deletedAt: number;
  purgeAt: number;
  size: number;
  files: OrphanMailShareFile[];
}

/**
 * Papelera administrativa de copias huérfanas: equipos y manuales borrados.
 *
 * Solo el administrador las ve, y no hay «restaurar»: la ficha ya no existe y
 * la copia no se puede volver a enganchar. La lista enseña lo que queda —y qué
 * archivos se pueden descargar— hasta que venza el plazo de siete días o
 * alguien la purgue.
 */
export const listOrphaned = query({
  args: {},
  handler: async (ctx): Promise<OrphanMailShareRow[]> => {
    await requireAdmin(ctx, "ver las copias de correo huérfanas");
    const rows = await ctx.db.query("mailShares").collect();
    return rows
      .filter(
        (row) =>
          row.destinationDeletedAt !== undefined &&
          row.contentPurgedAt === undefined,
      )
      .map((row) => ({
        shareId: row._id,
        destinationType: row.destinationType,
        destinationReference: row.destinationReference ?? "",
        subject: row.subject ?? "",
        fromName: row.fromName ?? "",
        fromAddress: row.fromAddress ?? "",
        mode: row.mode,
        deletedAt: row.destinationDeletedAt!,
        purgeAt: row.orphanPurgeAt ?? orphanPurgeAt(row.destinationDeletedAt!),
        size:
          (row.attachments ?? []).reduce(
            (sum, attachment) => sum + attachment.size,
            0,
          ) + (row.emlSize ?? 0),
        files: [
          ...(row.emlStorageId === undefined
            ? []
            : [
                {
                  kind: "eml" as const,
                  index: null,
                  name: row.emlFileName ?? "mensaje.eml",
                  size: row.emlSize ?? 0,
                },
              ]),
          ...(row.attachments ?? []).map((attachment, index) => ({
            kind: "attachment" as const,
            index,
            name: attachment.name,
            size: attachment.size,
          })),
        ],
      }))
      .sort((a, b) => a.purgeAt - b.purgeAt);
  },
});

const orphanFileValidator = v.union(v.literal("eml"), v.literal("attachment"));

/**
 * Resuelve el objeto de una copia huérfana para descargarlo.
 *
 * Es la ruta propia de la papelera administrativa: no pasa por la audiencia del
 * destino —la ficha ya no existe— y solo el administrador puede usarla. Se pide
 * expresamente el archivo, así que un adjunto fuera de rango o un `.eml` que no
 * se conservó se rechazan sin devolver nada.
 */
export const orphanDownloadContext = internalQuery({
  args: {
    shareId: v.id("mailShares"),
    file: orphanFileValidator,
    index: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    storageId: Id<"_storage">;
    name: string;
    contentType: string;
  }> => {
    await requireAdmin(ctx, "descargar una copia huérfana de correo");
    const row = await ctx.db.get(args.shareId);
    if (!row) throw new ConvexError("Esa copia ya no existe.");
    if (row.destinationDeletedAt === undefined) {
      throw new ConvexError("Esa copia no es huérfana: su ficha sigue viva.");
    }
    if (row.contentPurgedAt !== undefined) {
      throw new ConvexError("Esa copia ya no tiene contenido.");
    }

    if (args.file === "eml") {
      if (row.emlStorageId === undefined) {
        throw new ConvexError("Esa copia no conserva el archivo original.");
      }
      return {
        storageId: row.emlStorageId,
        name: row.emlFileName ?? "mensaje.eml",
        contentType: "message/rfc822",
      };
    }

    const attachment =
      args.index === undefined ? undefined : row.attachments?.[args.index];
    if (!attachment) {
      throw new ConvexError("Ese adjunto no existe en la copia.");
    }
    return {
      storageId: attachment.storageId,
      name: attachment.name,
      contentType: attachment.contentType,
    };
  },
});

/**
 * URL de descarga de un archivo de una copia huérfana, solo para el
 * administrador. La comprobación vive en `orphanDownloadContext`, porque una
 * acción no lee la base de datos.
 */
export const downloadOrphaned = action({
  args: {
    shareId: v.id("mailShares"),
    file: orphanFileValidator,
    index: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string; name: string; contentType: string }> => {
    const target = await ctx.runQuery(
      internal.mailShares.orphanDownloadContext,
      args,
    );
    const url = await ctx.storage.getUrl(target.storageId);
    if (url === null) {
      throw new ConvexError("El archivo de la copia ya no está disponible.");
    }
    return { url, name: target.name, contentType: target.contentType };
  },
});

/**
 * Purga una huérfana antes de su plazo. La fila desaparece: sin destino vivo no
 * hay ficha que enseñe una lápida, así que solo queda la traza de auditoría.
 */
export const purgeOrphaned = mutation({
  args: { shareId: v.id("mailShares") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(
      ctx,
      "purgar una copia huérfana de correo",
    );
    const row = await ctx.db.get(args.shareId);
    if (!row) throw new ConvexError("Esa copia ya no existe.");
    if (row.destinationDeletedAt === undefined) {
      throw new ConvexError("Esa copia no es huérfana: su ficha sigue viva.");
    }

    await wipeShareContent(ctx, row, {
      reason: "orphan",
      by: admin._id,
      now: Date.now(),
    });
    await ctx.db.delete(row._id);
    await logSecurityEvent(ctx, {
      actorId: admin._id,
      action: "mail_share_orphan_purge",
      target: `${row.destinationType}:${row.destinationReference ?? ""}`,
      metadata: { shareId: row._id, reason: "orphan" },
    });
    return true;
  },
});

/**
 * Barrido diario de huérfanas: purga las que cumplieron sus siete días.
 *
 * El plazo es fijo y no depende de `storageSettings.trashRetentionDays`: la
 * papelera del taller es la del destino, no la de la copia. Va sin actor porque
 * no lo ordena nadie; la traza queda igual en `securityAuditLog`.
 */
export const sweepOrphaned = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now();
    const rows = await ctx.db
      .query("mailShares")
      .withIndex("by_orphan_purge", (q) => q.lte("orphanPurgeAt", now))
      .collect();

    let purged = 0;
    for (const row of rows) {
      if (row.orphanPurgeAt === undefined || row.orphanPurgeAt > now) continue;
      await wipeShareContent(ctx, row, { reason: "orphan", now });
      await ctx.db.delete(row._id);
      await logSecurityEvent(ctx, {
        action: "mail_share_orphan_purge",
        target: `${row.destinationType}:${row.destinationReference ?? ""}`,
        metadata: { shareId: row._id, reason: "expired" },
      });
      purged += 1;
    }
    return purged;
  },
});

/**
 * Busca la ficha destino por su referencia visible, para el diálogo de
 * compartición: `INC-0004`, `PET-0007`, `OC-0003`, el código o nombre del equipo
 * y el título del manual. Devuelve el id y la referencia canónica.
 */
export const findTarget = query({
  args: {
    destinationType: destinationTypeValidator,
    reference: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ id: string; reference: string } | null> => {
    const user = await requireMailboxMember(ctx);
    if (
      !(await hasCapability(ctx, user, SHARE_CAPABILITY[args.destinationType]))
    ) {
      return null;
    }
    const wanted = args.reference.trim();
    if (wanted === "") return null;
    const wantedLower = wanted.toLowerCase();

    if (args.destinationType === "incident") {
      const row = await ctx.db
        .query("incidents")
        .withIndex("by_reference", (q) => q.eq("reference", wanted))
        .first();
      return row ? { id: row._id, reference: row.reference } : null;
    }
    if (args.destinationType === "request") {
      const row = await ctx.db
        .query("partRequests")
        .withIndex("by_reference", (q) => q.eq("reference", wanted))
        .first();
      return row ? { id: row._id, reference: row.reference } : null;
    }
    if (args.destinationType === "purchaseOrder") {
      const row = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_reference", (q) => q.eq("reference", wanted))
        .first();
      return row ? { id: row._id, reference: row.reference } : null;
    }
    if (args.destinationType === "purchaseRequest") {
      const row = await ctx.db
        .query("purchaseRequests")
        .withIndex("by_reference", (q) => q.eq("reference", wanted))
        .first();
      return row ? { id: row._id, reference: row.reference } : null;
    }
    if (args.destinationType === "equipment") {
      const row = await ctx.db
        .query("equipment")
        .withIndex("by_code", (q) => q.eq("code", wanted))
        .first();
      if (row) return { id: row._id, reference: row.code ?? row.name };
      return null;
    }
    // Los manuales no tienen índice por título: se buscan en la lista, que es
    // corta y ya se lee entera en su módulo.
    const manuals = await ctx.db.query("manuals").collect();
    const manual = manuals.find(
      (row) => row.title.trim().toLowerCase() === wantedLower,
    );
    return manual ? { id: manual._id, reference: manual.title } : null;
  },
});

/** Lo que el diálogo necesita para ofrecer destinos: solo las capacidades. */
export const canShare = query({
  args: {},
  handler: async (ctx): Promise<{ grants: Record<string, boolean> }> => {
    const user = await requireMailboxMember(ctx);
    const capabilities: Capability[] = [
      ...Object.values(SHARE_CAPABILITY),
      "createIncidentFromMail",
    ];
    const grants: Record<string, boolean> = {};
    for (const capability of new Set(capabilities)) {
      grants[capability] = await hasCapability(ctx, user, capability);
    }
    return { grants };
  },
});
