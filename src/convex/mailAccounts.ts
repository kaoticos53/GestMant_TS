import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { decryptSecret, encryptSecret, secretHint } from "./_auth/secretCrypto";
import { identityNotice, secureMutation } from "./_auth/secureMutation";
import { logSecurityEvent } from "./audit";
import {
  MAIL_SERVER_URL,
  clampCacheLimit,
  clampCacheRetention,
  normalizeMailAddress,
} from "../lib/mailClient/account";
import { parseAuthResponse } from "../lib/mailClient/auth";
import {
  classifyHttpFailure,
  parseSoapFault,
  type MailFault,
} from "../lib/mailClient/errors";
import { parseMailFolders } from "../lib/mailClient/folders";
import {
  buildAuthRequest,
  buildGetFolderRequest,
} from "../lib/mailClient/soap";
import type { MailFolder } from "../lib/mailClient/types";
import { hasCapability, memberStatus } from "./permissions";

const SOAP_ENDPOINT = `${MAIL_SERVER_URL}/service/soap`;

const MAILBOX_DENY =
  "No tienes permisos para usar el buzón de correo. Revisa la configuración de tu rol con el administrador.";
const MAILBOX_IDENTITY = identityNotice(
  "Debes iniciar sesión para usar tu buzón.",
  "Esta cuenta ha sido dada de baja o no está activa.",
);

/** La cuenta de la persona de la sesión; una fila por usuario. */
async function readAccount(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"mailAccounts"> | null> {
  return await ctx.db
    .query("mailAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

/** Lo que puede ver el navegador: nunca contraseña, token ni secreto completo. */
function publicAccount(row: Doc<"mailAccounts">) {
  return {
    email: row.email,
    serverUrl: row.serverUrl,
    status: row.status,
    enabled: row.enabled,
    cacheLimitBytes: row.cacheLimitBytes,
    cacheRetentionDays: row.cacheRetentionDays,
    cacheBytes: row.cacheBytes,
    hasPassword: (row.password ?? "").trim() !== "",
    passwordHint: row.passwordHint ?? "",
    lastSyncAt: row.lastSyncAt ?? null,
    lastSyncError: row.lastSyncError ?? null,
    updatedAt: row.updatedAt,
  };
}

/** Borra las carpetas locales de una cuenta. La usan editar, desconectar y borrar. */
async function deleteFolders(
  ctx: MutationCtx,
  accountId: Id<"mailAccounts">,
): Promise<void> {
  const folders = await ctx.db
    .query("mailFolders")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .collect();
  for (const folder of folders) await ctx.db.delete(folder._id);
}

/** La persona del taller con capacidad de buzón, o el aviso que corresponda. */
async function requireMailboxMember(ctx: QueryCtx): Promise<Doc<"users">> {
  const { user, issue } = await memberStatus(ctx);
  if (!user || issue !== null) {
    throw new ConvexError(
      issue === "inactiva"
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : MAILBOX_IDENTITY(issue ?? "sin_sesion"),
    );
  }
  if (!(await hasCapability(ctx, user, "viewMailbox"))) {
    throw new ConvexError(MAILBOX_DENY);
  }
  return user;
}

const folderValidator = v.object({
  remoteId: v.string(),
  parentRemoteId: v.union(v.string(), v.null()),
  name: v.string(),
  path: v.string(),
  kind: v.union(v.string(), v.null()),
  isMail: v.boolean(),
  unread: v.number(),
  total: v.number(),
  size: v.number(),
  sortOrder: v.number(),
});

const saveArgs = {
  email: v.string(),
  password: v.optional(v.string()),
  enabled: v.boolean(),
  cacheLimitBytes: v.number(),
  cacheRetentionDays: v.number(),
};

/**
 * Alta y edición de la cuenta propia. No acepta `userId` ni `serverUrl`: el
 * usuario sale de la sesión y el servidor es siempre el fijo del taller.
 */
export const save = mutation({
  args: saveArgs,
  handler: secureMutation(
    {
      capability: "viewMailbox",
      denyMessage: MAILBOX_DENY,
      identityMessage: MAILBOX_IDENTITY,
    },
    saveArgs,
    async (ctx, args, actor) => {
      const email = normalizeMailAddress(args.email);
      if (email === null) {
        throw new ConvexError(
          "Escribe una dirección de correo completa, por ejemplo nombre@rtva.es.",
        );
      }

      const existing = await readAccount(ctx, actor._id);
      const incomingPassword = (args.password ?? "").trim();
      let encryptedPassword = existing?.password;
      let passwordHint = existing?.passwordHint;

      if (incomingPassword !== "") {
        if (incomingPassword.length > 512) {
          throw new ConvexError(
            "La contraseña de aplicación es demasiado larga.",
          );
        }
        encryptedPassword = await encryptSecret(incomingPassword);
        passwordHint = secretHint(incomingPassword);
      } else if (!existing) {
        throw new ConvexError(
          "La contraseña de aplicación es obligatoria para configurar el buzón.",
        );
      }

      const now = Date.now();
      const emailChanged = existing !== null && existing.email !== email;
      const credentialsChanged =
        existing === null || emailChanged || incomingPassword !== "";
      const status =
        existing === null || credentialsChanged
          ? "disconnected"
          : existing.status;
      const tokenFields = credentialsChanged
        ? {
            authToken: undefined,
            tokenExpiresAt: undefined,
            lastSyncError: undefined,
          }
        : {};
      const mailboxResetFields = emailChanged
        ? {
            cacheBytes: 0,
            cacheBodyBytes: 0,
            cacheAttachmentBytes: 0,
            lastSyncAt: undefined,
            lastSyncOkAt: undefined,
            syncLeaseUntil: undefined,
          }
        : {};

      const record = {
        email,
        serverUrl: MAIL_SERVER_URL,
        status,
        enabled: args.enabled,
        cacheLimitBytes: clampCacheLimit(args.cacheLimitBytes),
        cacheRetentionDays: clampCacheRetention(args.cacheRetentionDays),
        updatedAt: now,
        ...(encryptedPassword === undefined
          ? { password: undefined, passwordHint: undefined }
          : { password: encryptedPassword, passwordHint }),
        ...tokenFields,
        ...mailboxResetFields,
      };

      let accountId: Id<"mailAccounts">;
      if (existing) {
        await ctx.db.patch(existing._id, record);
        if (emailChanged) await deleteFolders(ctx, existing._id);
        accountId = existing._id;
      } else {
        accountId = await ctx.db.insert("mailAccounts", {
          userId: actor._id,
          ...record,
          cacheBytes: 0,
          cacheBodyBytes: 0,
          cacheAttachmentBytes: 0,
          createdAt: now,
        });
      }

      await logSecurityEvent(ctx, {
        actorId: actor._id,
        action: "mail_account_change",
        target: `user:${actor._id}`,
        metadata: {
          op: existing ? "update" : "create",
          accountId,
          hasPassword: encryptedPassword !== undefined,
          status,
          emailChanged,
        },
      });

      const saved = await ctx.db.get(accountId);
      if (!saved)
        throw new ConvexError("No se pudo guardar la cuenta del buzón.");
      return publicAccount(saved);
    },
  ),
});

/** La cuenta propia para Ajustes; no hay pantalla de buzones ajenos. */
export const account = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const row = await readAccount(ctx, user._id);
    return row === null ? null : publicAccount(row);
  },
});

/** Carpetas de correo de la cuenta propia, ya filtradas por `isMail`. */
export const folders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const row = await readAccount(ctx, user._id);
    if (!row) return [];
    const folders = await ctx.db
      .query("mailFolders")
      .withIndex("by_account", (q) => q.eq("accountId", row._id))
      .collect();
    return folders
      .filter((folder) => folder.isMail)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((folder) => ({
        remoteId: folder.remoteId,
        parentRemoteId: folder.parentRemoteId,
        name: folder.name,
        path: folder.path,
        kind: folder.kind,
        isMail: folder.isMail,
        unread: folder.unread,
        total: folder.total,
        size: folder.size,
      }));
  },
});

/** Contexto mínimo que necesita la acción; la contraseña sigue cifrada. */
export const connectionContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireMailboxMember(ctx);
    const row = await readAccount(ctx, user._id);
    if (!row) {
      throw new ConvexError("Todavía no has configurado tu buzón.");
    }
    if ((row.password ?? "").trim() === "") {
      throw new ConvexError(
        "Vuelve a guardar la contraseña de aplicación antes de probar el buzón.",
      );
    }
    return {
      accountId: row._id,
      email: row.email,
      password: row.password ?? "",
    };
  },
});

/** Guarda el resultado bueno de Auth + GetFolder y descubre las carpetas. */
export const recordConnected = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    authToken: v.string(),
    tokenExpiresAt: v.number(),
    folders: v.array(folderValidator),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new ConvexError("La cuenta del buzón ya no existe.");
    const now = Date.now();
    await ctx.db.patch(account._id, {
      status: "connected",
      authToken: args.authToken,
      tokenExpiresAt: args.tokenExpiresAt,
      lastSyncError: undefined,
      updatedAt: now,
    });

    for (const folder of args.folders) {
      const existing = await ctx.db
        .query("mailFolders")
        .withIndex("by_account_remote", (q) =>
          q.eq("accountId", account._id).eq("remoteId", folder.remoteId),
        )
        .first();
      const record = {
        userId: account.userId,
        accountId: account._id,
        remoteId: folder.remoteId,
        parentRemoteId: folder.parentRemoteId,
        name: folder.name,
        path: folder.path,
        kind: folder.kind,
        isMail: folder.isMail,
        unread: folder.unread,
        total: folder.total,
        size: folder.size,
        sortOrder: folder.sortOrder,
        syncEnabled: existing?.syncEnabled ?? true,
      };
      if (existing) {
        await ctx.db.patch(existing._id, record);
      } else {
        await ctx.db.insert("mailFolders", record);
      }
    }
  },
});

/** Deja constancia del fallo sin guardar cuerpos, asuntos ni direcciones. */
export const recordFailure = internalMutation({
  args: {
    accountId: v.id("mailAccounts"),
    status: v.union(v.literal("reauthRequired"), v.literal("error")),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    await ctx.db.patch(account._id, {
      status: args.status,
      authToken: undefined,
      tokenExpiresAt: undefined,
      lastSyncError: args.error.slice(0, 240),
      updatedAt: Date.now(),
    });
  },
});

/** Texto saneado y corto: código y Trace, nunca el mensaje completo del servidor. */
function failureLabel(status: number, fault: MailFault | null): string {
  if (fault) {
    return fault.trace ? `${fault.code} (Trace ${fault.trace})` : fault.code;
  }
  return `Error HTTP ${status}`;
}

class MailConnectionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fault: MailFault | null,
  ) {
    super(message);
    this.name = "MailConnectionError";
  }
}

async function postSoap(body: string): Promise<string> {
  const response = await fetch(SOAP_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body,
  });
  const text = await response.text();
  let fault: MailFault | null = null;
  try {
    fault = parseSoapFault(text);
  } catch {
    fault = null;
  }
  if (fault !== null || !response.ok) {
    throw new MailConnectionError(
      failureLabel(response.status, fault),
      response.status,
      fault,
    );
  }
  return text;
}

/** Autentica y descubre carpetas; no persiste nada. */
async function probeMailbox(
  email: string,
  password: string,
): Promise<{
  authToken: string;
  lifetimeMs: number;
  folders: MailFolder[];
}> {
  const auth = parseAuthResponse(
    await postSoap(buildAuthRequest({ account: email, password })),
  );
  const folders = parseMailFolders(
    await postSoap(buildGetFolderRequest({ authToken: auth.authToken })),
  );
  return {
    authToken: auth.authToken,
    lifetimeMs: auth.lifetimeMs,
    folders,
  };
}

/**
 * Prueba la cuenta contra el servidor fijo: Auth y GetFolder. Nunca usa un host
 * del cliente y nunca devuelve la contraseña ni el token al navegador.
 */
export const testConnection = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ ok: true; email: string; folderCount: number }> => {
    const context = await ctx.runQuery(
      internal.mailAccounts.connectionContext,
      {},
    );
    const password = await decryptSecret(context.password);
    if (password.trim() === "") {
      throw new ConvexError(
        "La contraseña de aplicación ya no está disponible.",
      );
    }

    let probe: Awaited<ReturnType<typeof probeMailbox>>;
    try {
      probe = await probeMailbox(context.email, password);
    } catch (error) {
      const failure =
        error instanceof MailConnectionError
          ? error
          : new MailConnectionError(
              error instanceof Error ? error.message : "Error de conexión",
              0,
              null,
            );
      const credentialFailure = classifyHttpFailure({
        status: failure.status,
        fault: failure.fault,
      }).requiresCredentials;
      await ctx.runMutation(internal.mailAccounts.recordFailure, {
        accountId: context.accountId,
        status: credentialFailure ? "reauthRequired" : "error",
        error: failure.message,
      });
      throw new ConvexError(
        credentialFailure
          ? "La contraseña de aplicación no es válida o ha caducado. Revisa las credenciales del buzón."
          : `No se pudo conectar con el buzón: ${failure.message}`,
      );
    }

    await ctx.runMutation(internal.mailAccounts.recordConnected, {
      accountId: context.accountId,
      authToken: await encryptSecret(probe.authToken),
      tokenExpiresAt: Date.now() + probe.lifetimeMs,
      folders: probe.folders,
    });
    return {
      ok: true as const,
      email: context.email,
      folderCount: probe.folders.length,
    };
  },
});

/** Desconecta sin borrar la cuenta; la caché se conserva salvo que se pida. */
export const disconnect = mutation({
  args: { deleteCache: v.boolean() },
  handler: secureMutation(
    {
      capability: "viewMailbox",
      denyMessage: MAILBOX_DENY,
      identityMessage: MAILBOX_IDENTITY,
    },
    { deleteCache: v.boolean() },
    async (ctx, args, actor) => {
      const row = await readAccount(ctx, actor._id);
      if (!row) return true;

      if (args.deleteCache) await deleteFolders(ctx, row._id);

      await ctx.db.patch(row._id, {
        status: "disconnected",
        password: undefined,
        passwordHint: undefined,
        authToken: undefined,
        tokenExpiresAt: undefined,
        lastSyncError: undefined,
        lastSyncAt: undefined,
        lastSyncOkAt: undefined,
        syncLeaseUntil: undefined,
        ...(args.deleteCache
          ? { cacheBytes: 0, cacheBodyBytes: 0, cacheAttachmentBytes: 0 }
          : {}),
        updatedAt: Date.now(),
      });
      await logSecurityEvent(ctx, {
        actorId: actor._id,
        action: "mail_account_change",
        target: `user:${actor._id}`,
        metadata: { op: "disconnect", deleteCache: args.deleteCache },
      });
      return true;
    },
  ),
});

/** Borra la cuenta y sus datos locales; las copias compartidas no se tocan. */
export const remove = mutation({
  args: {},
  handler: secureMutation(
    {
      capability: "viewMailbox",
      denyMessage: MAILBOX_DENY,
      identityMessage: MAILBOX_IDENTITY,
    },
    {},
    async (ctx, _args, actor) => {
      const row = await readAccount(ctx, actor._id);
      if (!row) return true;

      await deleteFolders(ctx, row._id);
      await ctx.db.delete(row._id);
      await logSecurityEvent(ctx, {
        actorId: actor._id,
        action: "mail_account_change",
        target: `user:${actor._id}`,
        metadata: { op: "delete", accountId: row._id },
      });
      return true;
    },
  ),
});
