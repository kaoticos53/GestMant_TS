import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { identityNotice, secureMutation } from "./_auth/secureMutation";
import { memberOrNull } from "./permissions";
import { richDocToPlainText, richDocToStore } from "../lib/richDoc";

/** Longitud máxima del texto de un mensaje (lo que se lee, sin su formato). */
const MAX_TEXT = 1500;

/**
 * Tope del documento guardado. El formato —párrafos, listas, marcas, el
 * enlace de una imagen— ocupa más que el texto que se lee, así que se deja
 * holgura respecto al límite de caracteres, pero no tanta como para que un
 * mensaje pueda arrastrar un documento enorme.
 */
const MAX_DOC = MAX_TEXT * 4;

type Actor = Doc<"users">;
type Message = Doc<"messages">;

/** Usuario autenticado o error. */
async function requireActor(ctx: QueryCtx | MutationCtx): Promise<Actor> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para usar la mensajería.",
    );
  }
  return user;
}

function actorName(user: Actor): string {
  return user.name?.trim() || user.email?.trim() || "Usuario del taller";
}

/** Todos los mensajes en los que participa el usuario (dos índices). */
async function myMessages(
  ctx: QueryCtx | MutationCtx,
  userId: Actor["_id"],
): Promise<Message[]> {
  const [inbound, outbound] = await Promise.all([
    ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect(),
    ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect(),
  ]);
  return [...inbound, ...outbound];
}

/**
 * Orden cronológico con desempate por `_id` (los ids crecen con cada
 * inserción): dos mensajes en el mismo milisegundo quedan siempre en el
 * mismo orden aunque lleguen de los dos índices.
 */
function newestFirst(a: Message, b: Message): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  if (a._id === b._id) return 0;
  return a._id < b._id ? 1 : -1;
}

function oldestFirst(a: Message, b: Message): number {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  if (a._id === b._id) return 0;
  return a._id < b._id ? -1 : 1;
}

/** Directorio para escribir a alguien: usuarios activos (sin ti). */
export const contacts = query({
  args: {},
  handler: async (ctx) => {
    // Invitado o cuenta de baja: vacío en vez de error. El centro de mensajes
    // vive en la cabecera del panel y pide esta lista al montar.
    const me = await memberOrNull(ctx);
    if (!me) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user._id !== me._id && user.active !== false)
      .map((user) => ({
        _id: user._id,
        name: actorName(user),
        position: user.position ?? null,
        role: user.role ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  },
});

/**
 * Todos mis mensajes (entrantes y salientes), más recientes primero. El
 * cliente agrupa por hilo y calcula los no leídos: la suscripción de Convex
 * mantiene el panel y el contador en tiempo real.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Invitado o cuenta de baja: vacío en vez de error (ver `contacts`).
    const me = await memberOrNull(ctx);
    if (!me) return [];
    const messages = await myMessages(ctx, me._id);
    return messages.sort(newestFirst);
  },
});

/** Conversación con un usuario concreto, en orden cronológico. */
export const thread = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await requireActor(ctx);
    const messages = await myMessages(ctx, me._id);
    return messages
      .filter(
        (message) =>
          (message.senderId === args.userId &&
            message.recipientId === me._id) ||
          (message.senderId === me._id && message.recipientId === args.userId),
      )
      .sort(oldestFirst);
  },
});

/** Envía un mensaje directo. */
const sendArgs = {
  recipientId: v.id("users"),
  text: v.string(),
};

export const send = mutation({
  args: sendArgs,
  handler: secureMutation(
    {
      capability: "sendMessages",
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para usar la mensajería.",
      ),
      denyMessage:
        "No tienes permisos para enviar mensajes. Revisa la configuración de tu rol con el administrador.",
    },
    sendArgs,
    async (ctx, args, actor) => {
      const me = actor;
      // Lo que se guarda es el documento del editor (o el texto plano de un
      // mensaje de siempre, que se guarda tal cual) y lo que se mide es su texto:
      // el formato no cuenta para el límite, que es el mismo que ya valida el
      // compositor. Un mensaje en blanco —o con formato pero sin nada escrito—
      // no es un mensaje.
      const text = richDocToStore(args.text);
      if (!text) {
        throw new ConvexError("Escribe un mensaje antes de enviarlo.");
      }
      if (richDocToPlainText(text).length > MAX_TEXT) {
        throw new ConvexError(
          `Los mensajes no pueden superar los ${MAX_TEXT} caracteres.`,
        );
      }
      if (text.length > MAX_DOC) {
        throw new ConvexError(
          `El mensaje lleva demasiado formato: los mensajes no pueden superar los ${MAX_TEXT} caracteres.`,
        );
      }
      if (args.recipientId === me._id) {
        throw new ConvexError("No puedes enviarte un mensaje a ti mismo.");
      }
      const recipient = await ctx.db.get(args.recipientId);
      if (!recipient) {
        throw new ConvexError("El destinatario ya no existe.");
      }
      if (recipient.active === false) {
        throw new ConvexError(
          `No puedes escribir a ${actorName(recipient)}: está dado de baja.`,
        );
      }

      await ctx.db.insert("messages", {
        senderId: me._id,
        senderName: actorName(me),
        recipientId: recipient._id,
        recipientName: actorName(recipient),
        text,
        read: false,
        createdAt: Date.now(),
      });
    },
  ),
});

/** Marca como leídos los mensajes que me envió ese usuario. */
const markThreadReadArgs = { userId: v.id("users") };

export const markThreadRead = mutation({
  args: markThreadReadArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión con una cuenta registrada para usar la mensajería.",
      ),
    },
    markThreadReadArgs,
    async (ctx, args, actor) => {
      const me = actor;
      const inbound = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (q) => q.eq("recipientId", me._id))
        .collect();
      const now = Date.now();
      let updated = 0;
      for (const message of inbound) {
        if (message.senderId === args.userId && !message.read) {
          await ctx.db.patch(message._id, { read: true, readAt: now });
          updated += 1;
        }
      }
      return updated;
    },
  ),
});
