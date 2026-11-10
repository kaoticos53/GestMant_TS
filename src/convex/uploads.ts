import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  looksLikeImage,
} from "../lib/upload";
import { internal } from "./_generated/api";
import {
  QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";

/**
 * Imágenes de las notas y las descripciones. Funcionan como los adjuntos de una
 * petición: el archivo se sube al almacenamiento de Convex y lo que se guarda en
 * la nota es su URL, así que el texto enriquecido no lleva el archivo dentro.
 *
 * El permiso aquí es tener sesión, no coordinar: quien escribe una nota es quien
 * la ilustra, y en el cuaderno escribe también el técnico asignado. Quien puede
 * tocar la nota —o la descripción— lo decide la función que la guarda.
 */
async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(
      "Debes iniciar sesión para adjuntar una imagen a una nota.",
    );
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para adjuntar una imagen a una nota.",
    );
  }
  return userId;
}

/** Comprobación interna de miembro activo para la acción de validación. */
export const assertUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return true;
  },
});

/** Retira del almacenamiento un archivo rechazado por firma o tamaño. */
export const discardInvalidUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const existing = await ctx.db.system.get("_storage", args.storageId);
    if (existing) {
      await ctx.storage.delete(args.storageId);
    }
  },
});

/** URL temporal de subida para una imagen de una nota o una descripción. */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Valida firma binaria (magic bytes) y tamaño máximo de la imagen ya subida
 * antes de devolver la URL con la que enlazarla en la nota. Si el fichero no es
 * una imagen permitida (p. ej. SVG, HTML o script renombrado) o supera el tope,
 * se elimina del almacenamiento y se rechaza.
 */
export const imageUrl = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<string | null> => {
    await ctx.runQuery(internal.uploads.assertUser, {});

    const file = await ctx.storage.get(args.storageId);
    if (!file) {
      throw new ConvexError(
        "La imagen no ha llegado al servidor: vuelve a adjuntarla.",
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      await ctx.runMutation(internal.uploads.discardInvalidUpload, {
        storageId: args.storageId,
      });
      throw new ConvexError(
        `Cada imagen puede pesar como mucho ${MAX_FILE_SIZE_LABEL}.`,
      );
    }

    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!looksLikeImage(head)) {
      await ctx.runMutation(internal.uploads.discardInvalidUpload, {
        storageId: args.storageId,
      });
      throw new ConvexError(
        "Solo se pueden adjuntar fotos (JPEG, PNG, HEIC, AVIF, WEBP o GIF).",
      );
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});
