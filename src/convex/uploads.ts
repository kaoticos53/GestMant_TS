import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { QueryCtx, mutation } from "./_generated/server";

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
  return userId;
}

/** URL temporal de subida para una imagen de una nota o una descripción. */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * La URL con la que enlazar la imagen ya subida, para meterla en la nota. Se
 * resuelve al vuelo y no se guarda en el editor: el archivo sigue siendo del
 * almacenamiento del taller, no del texto.
 */
export const imageUrl = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});
