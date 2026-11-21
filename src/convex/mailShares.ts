import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { logSecurityEvent } from "./audit";
import { readAccount, requireMailboxMember } from "./mailAccounts";
import type { Capability } from "../lib/permissions";
import { hasCapability, memberOrNull, requireAdmin } from "./permissions";
import { resolveDestination } from "./_mailShares/destinations";
import {
  BODY_HTML_MAX_CHARS,
  BODY_TEXT_MAX_CHARS,
  DESTINATION_AUDIENCE,
  DESTINATION_LABELS,
  SHARE_CAPABILITY,
  buildShareSummary,
  canReadSharedMail,
  fitsShareLimit,
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

interface ShareContext {
  userId: Id<"users">;
  userName: string;
  email: string;
  destinationReference: string;
  header: {
    messageId: string;
    subject: string;
    fromName: string;
    fromAddress: string;
    date: number;
    snippet: string;
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
    // `requireMailboxMember` ya exige sesión de taller y `viewMailbox`, que es
    // justo lo que pide compartir: no hay una segunda comprobación que hacer.
    const user = await requireMailboxMember(ctx);
    const account = await readAccount(ctx, user._id);
    if (!account) throw new ConvexError("Todavía no has configurado tu buzón.");

    const header = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", user._id)
          .eq("accountId", account._id)
          .eq("messageId", args.messageId),
      )
      .first();
    if (!header || header.deletedRemoteAt !== undefined) {
      throw new ConvexError("Ese mensaje no pertenece a tu buzón.");
    }

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
      !(await hasCapability(ctx, user, SHARE_CAPABILITY[args.destinationType]))
    ) {
      throw new ConvexError(
        `Tu rol no puede adjuntar correo a ${DESTINATION_LABELS[args.destinationType].toLowerCase()}.`,
      );
    }

    const mode = resolveShareMode(args.destinationType, args.mode);
    if (!mode.ok) throw new ConvexError(mode.error);

    return {
      userId: user._id,
      userName: user.name?.trim() || user.email?.trim() || "Miembro del taller",
      email: account.email,
      destinationReference: destination.reference,
      header: {
        messageId: header.messageId,
        subject: header.subject,
        fromName: header.fromName,
        fromAddress: header.fromAddress,
        date: header.date,
        snippet: header.snippet,
      },
    };
  },
});

interface CachedShareContent {
  text: string;
  html: string | null;
  attachments: {
    storageId: Id<"_storage">;
    name: string;
    contentType: string;
    size: number;
  }[];
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

const storedAttachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});

/**
 * Guarda la copia ya materializada. Idempotente por `clientShareId`: un
 * reintento devuelve la copia existente en vez de duplicarla.
 */
export const persistShare = internalMutation({
  args: {
    sourceMessageId: v.string(),
    sourceEmail: v.string(),
    destinationType: destinationTypeValidator,
    destinationId: v.string(),
    destinationReference: v.string(),
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
  },
  handler: async (ctx, args): Promise<Id<"mailShares">> => {
    if (args.clientShareId) {
      const existing = await ctx.db
        .query("mailShares")
        .withIndex("by_client_share", (q) =>
          q
            .eq("sharedBy", args.sharedBy)
            .eq("clientShareId", args.clientShareId),
        )
        .first();
      if (existing) return existing._id;
    }

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
  args: {
    shareId: v.id("mailShares"),
    destinationType: destinationTypeValidator,
    destinationReference: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) return;
    await logSecurityEvent(ctx, {
      actorId: share.sharedBy,
      action: "mail_share_create",
      target: `${args.destinationType}:${args.destinationReference}`,
      metadata: { shareId: args.shareId, mode: share.mode },
    });
  },
});

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
    if (args.mode === "original" && !cached) {
      throw new ConvexError(
        "Abre el mensaje antes de compartirlo en modo original: su contenido aún no se ha descargado.",
      );
    }

    const text = truncateShareText(cached?.text ?? "", BODY_TEXT_MAX_CHARS);
    const html = cached?.html
      ? truncateShareText(cached.html, BODY_HTML_MAX_CHARS)
      : null;

    const copied: Id<"_storage">[] = [];
    try {
      const attachments: {
        storageId: Id<"_storage">;
        name: string;
        contentType: string;
        size: number;
      }[] = [];
      for (const attachment of cached?.attachments ?? []) {
        if (args.mode !== "original") break;
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
        summary: buildShareSummary(
          cached?.text ?? base.header.snippet,
          base.header.subject,
        ),
        bodyText: args.mode === "original" ? text.value : undefined,
        bodyHtml:
          args.mode === "original" ? (html?.value ?? undefined) : undefined,
        bodyTruncated:
          args.mode === "original"
            ? text.truncated || (html?.truncated ?? false)
            : undefined,
        attachments: args.mode === "original" ? attachments : undefined,
        sharedBy: base.userId,
        sharedByName: base.userName,
        clientShareId: args.clientShareId,
      });

      await ctx.runMutation(internal.mailShares.auditShare, {
        shareId,
        destinationType: args.destinationType,
        destinationReference: base.destinationReference,
      });
      return { shareId };
    } catch (error) {
      for (const storageId of copied) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // El objeto pudo no llegar a escribirse; el barrido lo recoge igual.
        }
      }
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
  options: { purgedOrOrphan?: boolean } = {},
): Promise<Doc<"users"> | null> {
  const user = await memberOrNull(ctx);
  if (!user) return null;
  if (options.purgedOrOrphan === true && user.role !== "admin") return null;

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
  attachmentCount: number;
  purgedAt: number | null;
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
    attachmentCount: row.attachments?.length ?? 0,
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
  attachments: {
    index: number;
    name: string;
    contentType: string;
    size: number;
  }[];
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
        contentType: attachment.contentType,
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

    for (const attachment of row.attachments ?? []) {
      try {
        await ctx.storage.delete(attachment.storageId);
      } catch {
        // El barrido nocturno recoge lo que quede sin cita.
      }
    }
    if (row.emlStorageId) {
      try {
        await ctx.storage.delete(row.emlStorageId);
      } catch {
        // Igual que los adjuntos.
      }
    }

    await ctx.db.patch(row._id, {
      subject: undefined,
      fromName: undefined,
      fromAddress: undefined,
      summary: undefined,
      bodyText: undefined,
      bodyHtml: undefined,
      bodyTruncated: undefined,
      emlStorageId: undefined,
      emlFileName: undefined,
      emlSize: undefined,
      attachments: undefined,
      sourceMessageId: undefined,
      sourceEmail: undefined,
      contentPurgedAt: Date.now(),
      contentPurgedBy: admin._id,
      purgeReason: "manual",
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
  handler: async (
    ctx,
  ): Promise<{ canShare: boolean; grants: Record<string, boolean> }> => {
    const user = await requireMailboxMember(ctx);
    const capabilities: Capability[] = [
      ...Object.values(SHARE_CAPABILITY),
      "createIncidentFromMail",
    ];
    const grants: Record<string, boolean> = {};
    for (const capability of new Set(capabilities)) {
      grants[capability] = await hasCapability(ctx, user, capability);
    }
    const canShare = Object.values(SHARE_CAPABILITY).some(
      (capability) => grants[capability] === true,
    );
    return { canShare, grants };
  },
});
