import { internalQuery } from "./_generated/server";

/**
 * La comprobación de disponibilidad del taller (`/readyz`): una lectura de
 * verdad contra la base, por un índice, para distinguir «el proceso contesta»
 * de «el almacenamiento y el esquema están operativos».
 *
 * Va en una consulta interna y no en la acción HTTP porque una acción no puede
 * tocar la base: la sonda tiene que preguntarle a quien sí puede. No comprueba
 * nada más —ni sesiones, ni correo, ni almacén de archivos—: lo que se cae sin
 * avisar y deja la aplicación inservible es la base.
 *
 * La clave que se busca no existe: se lee un índice por una clave imposible a
 * propósito, para que la lectura no dependa de que haya filas. Lo que se mide
 * es que la consulta se pueda hacer.
 */
export const ready = internalQuery({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "__readyz__"))
      .first();
    return { latencyMs: Date.now() - startedAt };
  },
});
