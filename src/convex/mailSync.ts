import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { decryptSecret, encryptSecret } from "./_auth/secretCrypto";
import { MailSoapError, postSoap } from "./_mail/soap";
import { parseAuthResponse } from "../lib/mailClient/auth";
import { classifyHttpFailure } from "../lib/mailClient/errors";
import { parseMailFolders } from "../lib/mailClient/folders";
import {
  hasMoreSearchResults,
  nextSearchOffset,
  parseSearchResponse,
} from "../lib/mailClient/search";
import {
  buildAuthRequest,
  buildGetFolderRequest,
  buildSearchRequest,
  buildSyncRequest,
} from "../lib/mailClient/soap";
import { parseSyncResponse, shouldContinueSync } from "../lib/mailClient/sync";
import type { MailFolder, MailHeader } from "../lib/mailClient/types";

const PAGE_SIZE = 500;
const TOKEN_MARGIN_MS = 6 * 60 * 60 * 1000;
const LEASE_MS = 15 * 60 * 1000;
const CRON_INTERVAL_MS = 50 * 60 * 1000;
const CRON_GAP_MS = 2_000;
const MAX_PAGES = 100;

interface SyncSession {
  accountId: Id<"mailAccounts">;
  email: string;
  password: string;
  authToken: string;
  tokenExpiresAt: number;
}

type SyncFolderResult = { ok: true; folders: number; headers: number };

const headerValidator = v.object({
  messageId: v.string(),
  folderRemoteId: v.string(),
  conversationId: v.union(v.string(), v.null()),
  subject: v.string(),
  fromName: v.string(),
  fromAddress: v.string(),
  date: v.number(),
  size: v.number(),
  flags: v.string(),
  hasAttachments: v.boolean(),
  snippet: v.string(),
});

/** Reclama la cuenta una sola vez por pasada; una cuenta ocupada no se toca. */
export const claimLease = internalMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return false;
    const user = await ctx.db.get(account.userId);
    if (!user || user.active === false) return false;

    const now = Date.now();
    if (account.syncLeaseUntil !== undefined && account.syncLeaseUntil > now) {
      return false;
    }
    await ctx.db.patch(account._id, {
      syncLeaseUntil: now + LEASE_MS,
      lastSyncAt: now,
      updatedAt: now,
    });
    return true;
  },
});

/** Cierra una pasada correcta: el token y las cabeceras ya están escritos. */
export const finishSync = internalMutation({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    const now = Date.now();
    await ctx.db.patch(account._id, {
      status: "connected",
      lastSyncAt: now,
      lastSyncOkAt: now,
      lastSyncError: undefined,
      syncLeaseUntil: undefined,
      updatedAt: now,
    });
  },
});

/** Cierra una pasada fallida sin dejar el lease tomado para siempre. */
export const failSync = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    status: v.union(v.literal("reauthRequired"), v.literal("error")),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    const now = Date.now();
    await ctx.db.patch(account._id, {
      status: args.status,
      lastSyncAt: now,
      lastSyncError: args.error.slice(0, 240),
      syncLeaseUntil: undefined,
      updatedAt: now,
      ...(args.status === "reauthRequired"
        ? { authToken: undefined, tokenExpiresAt: undefined }
        : {}),
    });
  },
});

/**
 * Escribe una carpeta ya recorrida. Solo se llama cuando el recorrido completo
 * terminó: así una pasada cortada no marca ausentes ni avanza el token. La
 * identidad es cuenta + mensaje y una reaparición limpia la tumba.
 */
export const saveFolder = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    folderRemoteId: v.string(),
    headers: v.array(headerValidator),
    deletedIds: v.array(v.string()),
    token: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new ConvexError("La cuenta del buzón ya no existe.");
    const user = await ctx.db.get(account.userId);
    if (!user || user.active === false) return 0;

    const now = Date.now();
    const seen = new Set(args.headers.map((header) => header.messageId));

    for (const header of args.headers) {
      const existing = await ctx.db
        .query("mailHeaders")
        .withIndex("by_user_message", (q) =>
          q
            .eq("userId", user._id)
            .eq("accountId", account._id)
            .eq("messageId", header.messageId),
        )
        .first();
      const record = {
        userId: user._id,
        accountId: account._id,
        folderRemoteId: header.folderRemoteId || args.folderRemoteId,
        messageId: header.messageId,
        conversationId: header.conversationId ?? undefined,
        subject: header.subject,
        fromName: header.fromName,
        fromAddress: header.fromAddress,
        date: header.date,
        size: header.size,
        flags: header.flags,
        hasAttachments: header.hasAttachments,
        snippet: header.snippet,
      };
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...record,
          deletedRemoteAt: undefined,
        });
      } else {
        await ctx.db.insert("mailHeaders", {
          ...record,
          bodyState: "none",
        });
      }
    }

    for (const messageId of args.deletedIds) {
      if (seen.has(messageId)) continue;
      const existing = await ctx.db
        .query("mailHeaders")
        .withIndex("by_user_message", (q) =>
          q
            .eq("userId", user._id)
            .eq("accountId", account._id)
            .eq("messageId", messageId),
        )
        .first();
      if (existing && existing.deletedRemoteAt === undefined) {
        await ctx.db.patch(existing._id, { deletedRemoteAt: now });
      }
    }

    const localFolder = await ctx.db
      .query("mailHeaders")
      .withIndex("by_user_folder_date", (q) =>
        q.eq("userId", user._id).eq("folderRemoteId", args.folderRemoteId),
      )
      .collect();
    for (const row of localFolder) {
      // Si la cabecera ya apunta a otra carpeta, el mensaje se movió: la
      // pasada de la carpeta destino la actualizó y no es un borrado.
      if (
        !seen.has(row.messageId) &&
        row.folderRemoteId === args.folderRemoteId &&
        row.deletedRemoteAt === undefined
      ) {
        await ctx.db.patch(row._id, { deletedRemoteAt: now });
      }
    }

    const folder = await ctx.db
      .query("mailFolders")
      .withIndex("by_account_remote", (q) =>
        q.eq("accountId", account._id).eq("remoteId", args.folderRemoteId),
      )
      .first();
    if (folder) {
      await ctx.db.patch(folder._id, {
        syncToken: args.token ?? undefined,
        lastSyncAt: now,
        lastError: undefined,
        unread: args.headers.filter((header) => header.flags.includes("u"))
          .length,
        total: args.headers.length,
        size: args.headers.reduce((sum, header) => sum + header.size, 0),
      });
    }

    return args.headers.length;
  },
});

/** Tokens por carpeta ya guardados; el parser de GetFolder no los trae. */
export const folderTokens = internalQuery({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const folders = await ctx.db
      .query("mailFolders")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
    const tokens: Record<string, string | null> = {};
    for (const folder of folders) {
      tokens[folder.remoteId] = folder.syncToken ?? null;
    }
    return tokens;
  },
});

/** Cuentas que el cron debe mirar: encendidas, de usuarios activos y no recientes. */
export const dueAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("mailAccounts")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const cutoff = Date.now() - CRON_INTERVAL_MS;
    const due: Id<"mailAccounts">[] = [];
    for (const account of accounts) {
      const user = await ctx.db.get(account.userId);
      if (!user || user.active === false) continue;
      if (account.lastSyncAt !== undefined && account.lastSyncAt > cutoff) {
        continue;
      }
      due.push(account._id);
    }
    return due;
  },
});

/** Contexto mínimo de una cuenta para el cron; nunca se expone al navegador. */
export const accountContext = internalQuery({
  args: { accountId: v.id("mailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || !account.enabled) return null;
    const user = await ctx.db.get(account.userId);
    if (!user || user.active === false) return null;
    return {
      accountId: account._id,
      email: account.email,
      password: account.password ?? "",
      authToken: account.authToken ?? "",
      tokenExpiresAt: account.tokenExpiresAt ?? 0,
    } satisfies SyncSession;
  },
});

class ReauthRequiredError extends Error {
  constructor() {
    super("La contraseña de aplicación no es válida o ha caducado.");
    this.name = "ReauthRequiredError";
  }
}

/** Token reutilizable si le quedan más de seis horas; si no, Auth una vez. */
async function resolveAuth(
  session: SyncSession,
): Promise<{ authToken: string; expiresAt: number }> {
  if (
    session.authToken.trim() !== "" &&
    session.tokenExpiresAt > Date.now() + TOKEN_MARGIN_MS
  ) {
    return {
      authToken: await decryptSecret(session.authToken),
      expiresAt: session.tokenExpiresAt,
    };
  }
  if (session.password.trim() === "") throw new ReauthRequiredError();

  const password = await decryptSecret(session.password);
  if (password.trim() === "") throw new ReauthRequiredError();
  const auth = parseAuthResponse(
    await postSoap(buildAuthRequest({ account: session.email, password })),
  );
  return {
    authToken: auth.authToken,
    expiresAt: Date.now() + auth.lifetimeMs,
  };
}

async function syncFolder(
  ctx: ActionCtx,
  session: SyncSession,
  authToken: string,
  folder: MailFolder,
  savedToken: string | null,
): Promise<number> {
  let token = savedToken;
  const deletedIds: string[] = [];

  try {
    let more = true;
    let pages = 0;
    while (more && pages < MAX_PAGES) {
      const page = parseSyncResponse(
        await postSoap(
          buildSyncRequest({
            authToken,
            folderId: folder.remoteId,
            token,
          }),
        ),
      );
      deletedIds.push(...page.deletedIds);
      token = page.token ?? token;
      more = shouldContinueSync(page.more);
      pages += 1;
    }
  } catch (error) {
    const invalidToken =
      error instanceof MailSoapError &&
      classifyHttpFailure({
        status: error.status,
        fault: error.fault,
      }).invalidSyncToken;
    if (!invalidToken) throw error;
    token = null;
    deletedIds.length = 0;
  }

  const headers: MailHeader[] = [];
  let offset = 0;
  let more = true;
  let pages = 0;
  while (more && pages < MAX_PAGES) {
    const page = parseSearchResponse(
      await postSoap(
        buildSearchRequest({
          authToken,
          folderPath: folder.path,
          offset,
          limit: PAGE_SIZE,
          sortBy: "dateAsc",
        }),
      ),
    );
    headers.push(...page.headers);
    const count = page.headers.length;
    more =
      count > 0 &&
      hasMoreSearchResults({
        more: page.more,
        count,
        limit: PAGE_SIZE,
      });
    offset = nextSearchOffset(offset, count);
    pages += 1;
  }

  return await ctx.runMutation(internal.mailSync.saveFolder, {
    accountId: session.accountId,
    folderRemoteId: folder.remoteId,
    headers,
    deletedIds,
    token,
  });
}

function failureMessage(error: unknown): string {
  if (error instanceof MailSoapError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error de conexión";
}

function isCredentialFailure(error: unknown): boolean {
  if (error instanceof ReauthRequiredError) return true;
  if (!(error instanceof MailSoapError)) return false;
  return classifyHttpFailure({
    status: error.status,
    fault: error.fault,
  }).requiresCredentials;
}

async function syncMailbox(
  ctx: ActionCtx,
  session: SyncSession,
  folderRemoteId?: string,
): Promise<SyncFolderResult | { ok: false; reason: "busy" }> {
  const claimed = await ctx.runMutation(internal.mailSync.claimLease, {
    accountId: session.accountId,
  });
  if (!claimed) return { ok: false, reason: "busy" };

  try {
    const auth = await resolveAuth(session);
    const folders = parseMailFolders(
      await postSoap(buildGetFolderRequest({ authToken: auth.authToken })),
    );
    await ctx.runMutation(internal.mailAccounts.recordConnected, {
      accountId: session.accountId,
      authToken: await encryptSecret(auth.authToken),
      tokenExpiresAt: auth.expiresAt,
      folders,
    });

    const selected =
      folderRemoteId === undefined
        ? folders
        : folders.filter((folder) => folder.remoteId === folderRemoteId);
    if (folderRemoteId !== undefined && selected.length === 0) {
      throw new ConvexError("Esa carpeta ya no existe en el buzón.");
    }

    const tokens = await ctx.runQuery(internal.mailSync.folderTokens, {
      accountId: session.accountId,
    });
    let headers = 0;
    for (const folder of selected) {
      headers += await syncFolder(
        ctx,
        session,
        auth.authToken,
        folder,
        tokens[folder.remoteId] ?? null,
      );
    }

    await ctx.runMutation(internal.mailSync.finishSync, {
      accountId: session.accountId,
    });
    return { ok: true, folders: selected.length, headers };
  } catch (error) {
    await ctx.runMutation(internal.mailSync.failSync, {
      accountId: session.accountId,
      status: isCredentialFailure(error) ? "reauthRequired" : "error",
      error: failureMessage(error),
    });
    throw new ConvexError(
      isCredentialFailure(error)
        ? "La contraseña de aplicación no es válida o ha caducado. Revisa las credenciales del buzón."
        : `No se pudo sincronizar el buzón: ${failureMessage(error)}`,
    );
  }
}

/** Sincronización bajo demanda de la cuenta propia, completa o de una carpeta. */
export const syncNow = action({
  args: { folderRemoteId: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<SyncFolderResult | { ok: false; reason: "busy" }> => {
    const context: SyncSession = await ctx.runQuery(
      internal.mailAccounts.connectionContext,
      {},
    );
    return await syncMailbox(ctx, context, args.folderRemoteId);
  },
});

/** Una cuenta concreta, llamada por el cron; la baja se comprueba antes. */
export const syncAccount = internalAction({
  args: { accountId: v.id("mailAccounts") },
  handler: async (
    ctx,
    args,
  ): Promise<SyncFolderResult | { ok: false; reason: "busy" | "skipped" }> => {
    const context: SyncSession | null = await ctx.runQuery(
      internal.mailSync.accountContext,
      { accountId: args.accountId },
    );
    if (!context) return { ok: false, reason: "skipped" };
    return await syncMailbox(ctx, context);
  },
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pasada horaria: cuentas activas, una acción por cuenta y 2 s entre ellas. */
export const syncDue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ attempted: number }> => {
    const accounts: Id<"mailAccounts">[] = await ctx.runQuery(
      internal.mailSync.dueAccounts,
      {},
    );
    for (let index = 0; index < accounts.length; index += 1) {
      try {
        await ctx.runAction(internal.mailSync.syncAccount, {
          accountId: accounts[index],
        });
      } catch {
        // El fallo ya quedó apuntado en la cuenta por syncAccount.
      }
      if (index < accounts.length - 1) await sleep(CRON_GAP_MS);
    }
    return { attempted: accounts.length };
  },
});
