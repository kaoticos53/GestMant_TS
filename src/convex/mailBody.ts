import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { decryptSecret, encryptSecret } from "./_auth/secretCrypto";
import { readAccount, requireMailboxMember } from "./mailAccounts";
import {
  clearHeaderCache,
  deleteMessageContent,
  recountAccount,
} from "./_mail/cache";
import { MailSoapError, postSoap } from "./_mail/soap";
import { parseAuthResponse } from "../lib/mailClient/auth";
import {
  MAX_MESSAGE_BYTES,
  isCacheableMessage,
  planCacheEviction,
  type CachedMessage,
} from "../lib/mailClient/cache";
import { classifyHttpFailure } from "../lib/mailClient/errors";
import {
  parseGetMessageResponse,
  resolveContentUrl,
} from "../lib/mailClient/getMessage";
import { parseMailMessage } from "../lib/mailClient/mime";
import { MAIL_SERVER_URL } from "../lib/mailClient/account";
import {
  buildAuthRequest,
  buildGetMessageRequest,
} from "../lib/mailClient/soap";

const TOKEN_MARGIN_MS = 6 * 60 * 60 * 1000;

interface BodySession {
  accountId: Id<"mailAccounts">;
  email: string;
  password: string;
  authToken: string;
  tokenExpiresAt: number;
}

interface BodyHeader {
  id: Id<"mailHeaders">;
  messageId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  date: number;
  size: number;
  bodyState: Doc<"mailHeaders">["bodyState"];
}

interface CachedAttachment {
  id: Id<"mailAttachments">;
  filename: string | null;
  contentType: string;
  size: number;
  contentId: string | null;
  inline: boolean;
  url: string | null;
}

interface CachedBody {
  text: string;
  textTruncated: boolean;
  html: string | null;
  htmlTruncated: boolean;
  bodyBytes: number;
  attachments: CachedAttachment[];
}

interface OpenedBody extends CachedBody {
  cached: boolean;
}

class ContentAuthError extends Error {
  constructor() {
    super("El servlet de contenido ha rechazado el token.");
    this.name = "ContentAuthError";
  }
}

/** Datos mínimos de la cabecera que necesita la descarga; sin contenido. */
function headerView(header: Doc<"mailHeaders">): BodyHeader {
  return {
    id: header._id,
    messageId: header.messageId,
    subject: header.subject,
    fromName: header.fromName,
    fromAddress: header.fromAddress,
    date: header.date,
    size: header.size,
    bodyState: header.bodyState,
  };
}

export const context = internalQuery({
  args: { messageId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ header: BodyHeader; session: BodySession }> => {
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
      throw new ConvexError("Ese mensaje ya no está en el buzón.");
    }
    return {
      header: headerView(header),
      session: {
        accountId: account._id,
        email: account.email,
        password: account.password ?? "",
        authToken: account.authToken ?? "",
        tokenExpiresAt: account.tokenExpiresAt ?? 0,
      } satisfies BodySession,
    };
  },
});

/** Cuerpo cacheado con las URL de sus adjuntos; no descarga nada. */
export const cachedContent = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, args): Promise<CachedBody | null> => {
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
      textTruncated: body.textTruncated,
      html: body.html ?? null,
      htmlTruncated: body.htmlTruncated,
      bodyBytes: body.bodyBytes,
      attachments: await Promise.all(
        attachments.map(async (attachment) => ({
          id: attachment._id,
          filename: attachment.filename ?? null,
          contentType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId ?? null,
          inline: attachment.inline,
          url: await ctx.storage.getUrl(attachment.storageId),
        })),
      ),
    };
  },
});

export const touch = internalMutation({
  args: { headerId: v.id("mailHeaders") },
  handler: async (ctx, args): Promise<void> => {
    const header = await ctx.db.get(args.headerId);
    if (!header || header.bodyState !== "cached") return;
    await ctx.db.patch(header._id, { lastOpenedAt: Date.now() });
  },
});

export const markState = internalMutation({
  args: {
    headerId: v.id("mailHeaders"),
    state: v.union(v.literal("tooLarge"), v.literal("error")),
  },
  handler: async (ctx, args): Promise<void> => {
    const header = await ctx.db.get(args.headerId);
    if (!header || header.bodyState === "cached") return;
    await ctx.db.patch(header._id, { bodyState: args.state });
  },
});

const storedAttachmentValidator = v.object({
  partIndex: v.number(),
  filename: v.optional(v.string()),
  contentType: v.string(),
  size: v.number(),
  contentId: v.optional(v.string()),
  inline: v.boolean(),
  storageId: v.id("_storage"),
});

/**
 * Escribe el cuerpo y sus adjuntos en una sola transacción, expulsa los
 * mensajes menos usados y deja los contadores al día. El RFC822 no entra aquí.
 */
export const cacheContent = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    messageId: v.string(),
    text: v.string(),
    textTruncated: v.boolean(),
    html: v.optional(v.string()),
    htmlTruncated: v.boolean(),
    bodyBytes: v.number(),
    attachments: v.array(storedAttachmentValidator),
  },
  handler: async (ctx, args): Promise<{ cached: boolean }> => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new ConvexError("La cuenta del buzón ya no existe.");
    const header = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_message", (q) =>
        q
          .eq("userId", account.userId)
          .eq("accountId", account._id)
          .eq("messageId", args.messageId),
      )
      .first();
    if (!header) throw new ConvexError("Ese mensaje ya no está en el buzón.");

    const attachmentBytes = args.attachments.reduce(
      (sum, attachment) => sum + attachment.size,
      0,
    );
    const incomingBytes = args.bodyBytes + attachmentBytes;
    if (!isCacheableMessage(incomingBytes, account.cacheLimitBytes)) {
      return { cached: false as const };
    }

    const usage = await recountAccount(ctx, account);
    const oldBytes =
      header.bodyState === "cached" ? (header.cachedBytes ?? 0) : 0;
    const rows = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_cached", (q) =>
        q.eq("userId", account.userId).eq("bodyState", "cached"),
      )
      .collect();
    const candidates: CachedMessage[] = rows
      .filter((row) => row.messageId !== args.messageId)
      .map((row) => ({
        messageId: row.messageId,
        cachedBytes: row.cachedBytes ?? 0,
        lastOpenedAt: row.lastOpenedAt ?? 0,
        cachedAt: row.cachedAt ?? 0,
      }));
    const plan = planCacheEviction({
      currentBytes: Math.max(0, usage.totalBytes - oldBytes),
      incomingBytes,
      limitBytes: account.cacheLimitBytes,
      messages: candidates,
    });
    if (!plan.cacheable) return { cached: false as const };

    for (const messageId of plan.evictedIds) {
      const evicted = rows.find((row) => row.messageId === messageId);
      if (!evicted) continue;
      await deleteMessageContent(ctx, evicted);
      await clearHeaderCache(ctx, evicted);
    }

    await deleteMessageContent(ctx, header);
    const now = Date.now();
    await ctx.db.insert("mailBodies", {
      userId: account.userId,
      accountId: account._id,
      messageId: args.messageId,
      text: args.text,
      textTruncated: args.textTruncated,
      html: args.html,
      htmlTruncated: args.htmlTruncated,
      bodyBytes: args.bodyBytes,
      parsedAt: now,
    });
    for (const attachment of args.attachments) {
      await ctx.db.insert("mailAttachments", {
        userId: account.userId,
        accountId: account._id,
        messageId: args.messageId,
        partIndex: attachment.partIndex,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        contentId: attachment.contentId,
        inline: attachment.inline,
        storageId: attachment.storageId,
        createdAt: now,
      });
    }
    await ctx.db.patch(header._id, {
      bodyState: "cached",
      cachedAt: now,
      lastOpenedAt: now,
      cachedBytes: incomingBytes,
    });
    await recountAccount(ctx, account);
    return { cached: true as const };
  },
});

async function resolveAuth(
  session: BodySession,
): Promise<{ token: string; expiresAt: number; refreshed: boolean }> {
  if (
    session.authToken.trim() !== "" &&
    session.tokenExpiresAt > Date.now() + TOKEN_MARGIN_MS
  ) {
    return {
      token: await decryptSecret(session.authToken),
      expiresAt: session.tokenExpiresAt,
      refreshed: false,
    };
  }
  if (session.password.trim() === "") {
    throw new ConvexError(
      "Vuelve a guardar la contraseña de aplicación para abrir el mensaje.",
    );
  }
  const password = await decryptSecret(session.password);
  if (password.trim() === "") {
    throw new ConvexError(
      "Vuelve a guardar la contraseña de aplicación para abrir el mensaje.",
    );
  }
  const auth = parseAuthResponse(
    await postSoap(buildAuthRequest({ account: session.email, password })),
  );
  return {
    token: auth.authToken,
    expiresAt: Date.now() + auth.lifetimeMs,
    refreshed: true,
  };
}

async function saveRefreshedToken(
  ctx: ActionCtx,
  accountId: Id<"mailAccounts">,
  token: string,
  expiresAt: number,
): Promise<void> {
  await ctx.runMutation(internal.mailAccounts.recordAuthToken, {
    accountId,
    authToken: await encryptSecret(token),
    tokenExpiresAt: expiresAt,
  });
}

async function fetchRawMessage(
  url: string,
  token: string,
): Promise<Uint8Array> {
  const response = await fetch(url, {
    method: "GET",
    headers: { cookie: `ZM_AUTH_TOKEN=${token}` },
    redirect: "error",
  });
  if (response.status === 401) throw new ContentAuthError();
  if (!response.ok) {
    throw new ConvexError(
      `No se pudo descargar el mensaje (HTTP ${response.status}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function failureText(error: unknown): string {
  if (error instanceof MailSoapError || error instanceof Error) {
    return error.message;
  }
  return "Error de descarga";
}

function isCredentialFailure(error: unknown): boolean {
  if (error instanceof ContentAuthError) return true;
  if (!(error instanceof MailSoapError)) return false;
  return classifyHttpFailure({
    status: error.status,
    fault: error.fault,
  }).requiresCredentials;
}

/** Abre un mensaje: reutiliza la caché o descarga, verifica, parsea y guarda. */
export const open = action({
  args: { messageId: v.string() },
  handler: async (ctx, args): Promise<OpenedBody> => {
    const cached = await ctx.runQuery(internal.mailBody.cachedContent, {
      messageId: args.messageId,
    });
    const context = await ctx.runQuery(internal.mailBody.context, {
      messageId: args.messageId,
    });
    if (cached) {
      await ctx.runMutation(internal.mailBody.touch, {
        headerId: context.header.id,
      });
      return { cached: true as const, ...cached };
    }

    if (context.header.size > MAX_MESSAGE_BYTES) {
      await ctx.runMutation(internal.mailBody.markState, {
        headerId: context.header.id,
        state: "tooLarge",
      });
      throw new ConvexError(
        "El mensaje supera el límite de 50 MB y no se puede abrir.",
      );
    }

    const storedIds: Id<"_storage">[] = [];
    try {
      const auth = await resolveAuth(context.session);
      if (auth.refreshed) {
        await saveRefreshedToken(
          ctx,
          context.session.accountId,
          auth.token,
          auth.expiresAt,
        );
      }

      const prepared = parseGetMessageResponse(
        await postSoap(
          buildGetMessageRequest({
            authToken: auth.token,
            messageId: args.messageId,
          }),
        ),
      );
      if (prepared.size <= 0) {
        throw new ConvexError("El servidor no indicó el tamaño del mensaje.");
      }
      if (context.header.size > 0 && prepared.size !== context.header.size) {
        throw new ConvexError(
          "El tamaño del mensaje no coincide con la cabecera; no se cacheó.",
        );
      }
      if (prepared.size > MAX_MESSAGE_BYTES) {
        await ctx.runMutation(internal.mailBody.markState, {
          headerId: context.header.id,
          state: "tooLarge",
        });
        throw new ConvexError(
          "El mensaje supera el límite de 50 MB y no se puede abrir.",
        );
      }

      const contentUrl = resolveContentUrl(
        MAIL_SERVER_URL,
        prepared.contentUrl,
      );
      let raw: Uint8Array;
      try {
        raw = await fetchRawMessage(contentUrl, auth.token);
      } catch (error) {
        if (!(error instanceof ContentAuthError)) throw error;
        const renewed = await resolveAuth({
          ...context.session,
          authToken: "",
          tokenExpiresAt: 0,
        });
        await saveRefreshedToken(
          ctx,
          context.session.accountId,
          renewed.token,
          renewed.expiresAt,
        );
        raw = await fetchRawMessage(contentUrl, renewed.token);
      }
      if (raw.byteLength !== prepared.size) {
        throw new ConvexError(
          "Los bytes descargados no coinciden con el tamaño del mensaje; no se cacheó.",
        );
      }

      const parsed = await parseMailMessage(raw);
      const stored: {
        partIndex: number;
        filename: string | undefined;
        contentType: string;
        size: number;
        contentId: string | undefined;
        inline: boolean;
        storageId: Id<"_storage">;
      }[] = [];
      for (const attachment of parsed.attachments) {
        const bytes = attachment.content.buffer.slice(
          attachment.content.byteOffset,
          attachment.content.byteOffset + attachment.content.byteLength,
        ) as ArrayBuffer;
        const storageId = await ctx.storage.store(
          new Blob([bytes], { type: attachment.contentType }),
        );
        storedIds.push(storageId);
        stored.push({
          partIndex: attachment.partIndex,
          filename: attachment.filename ?? undefined,
          contentType: attachment.contentType,
          size: attachment.content.byteLength,
          contentId: attachment.contentId ?? undefined,
          inline: attachment.inline,
          storageId,
        });
      }

      const saved = await ctx.runMutation(internal.mailBody.cacheContent, {
        accountId: context.session.accountId,
        messageId: args.messageId,
        text: parsed.text,
        textTruncated: parsed.textTruncated,
        html: parsed.html ?? undefined,
        htmlTruncated: parsed.htmlTruncated,
        bodyBytes: parsed.bodyBytes,
        attachments: stored,
      });
      if (!saved.cached) {
        for (const storageId of storedIds) await ctx.storage.delete(storageId);
        throw new ConvexError(
          "El mensaje no cabe en la caché configurada y no se guardó.",
        );
      }

      const result = await ctx.runQuery(internal.mailBody.cachedContent, {
        messageId: args.messageId,
      });
      if (!result) {
        throw new ConvexError("El cuerpo se guardó, pero no se pudo leer.");
      }
      return { cached: false as const, ...result };
    } catch (error) {
      for (const storageId of storedIds) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // El objeto pudo no llegar a escribirse; el barrido lo recoge igual.
        }
      }
      if (isCredentialFailure(error)) {
        await ctx.runMutation(internal.mailAccounts.recordFailure, {
          accountId: context.session.accountId,
          status: "reauthRequired",
          error: failureText(error),
        });
        await ctx.runMutation(internal.mailBody.markState, {
          headerId: context.header.id,
          state: "error",
        });
        throw new ConvexError(
          "La contraseña de aplicación no es válida o ha caducado. Revisa las credenciales del buzón.",
        );
      }
      await ctx.runMutation(internal.mailBody.markState, {
        headerId: context.header.id,
        state: "error",
      });
      if (error instanceof ConvexError) throw error;
      throw new ConvexError(
        `No se pudo abrir el mensaje: ${failureText(error)}`,
      );
    }
  },
});
