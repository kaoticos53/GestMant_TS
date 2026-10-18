import { v } from "convex/values";
import { MAIL_LOG_LIMIT } from "../lib/mail";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./permissions";

/**
 * El histórico del correo saliente: qué salió, a quién y qué contestó el
 * servicio.
 *
 * Un taller que manda avisos a gente de fuera necesita poder responder a «yo no
 * he recibido nada» sin abrir la ficha de cada incidencia. Aquí queda el sobre
 * —cuándo, de dónde salió el correo, los destinatarios, la copia oculta, el
 * asunto y el resultado— y **no el cuerpo**: el contenido ya se puede releer
 * donde se escribió, y guardarlo aquí sería una segunda copia de datos de gente
 * sin necesidad.
 *
 * Dos reglas:
 *
 * - **Solo el administrador lo lee.** Es el mismo permiso que configura el
 *   correo: quién recibe los avisos del taller no es cosa de cada rol.
 * - **Se poda solo.** Se queda con los últimos `MAIL_LOG_LIMIT` y borra los
 *   demás al apuntar un envío. Así el registro no crece sin freno y no hace falta
 *   una limpieza programada que alguien tenga que recordar.
 *
 * Este histórico no entra en el vaciado del taller (`workshopReset`): es
 * trazabilidad de lo que ya salió a la red, como el registro de auditoría, y
 * borrarlo no devuelve ningún correo.
 */

/** Los orígenes que se pueden apuntar, con su nombre en la pantalla. */
const originValidator = v.union(
  v.literal("incidencia"),
  v.literal("equipo"),
  v.literal("resumen"),
  v.literal("prueba"),
);

/** Un texto de una línea: el asunto viene de un correo y no debe romper la lista. */
function oneLine(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Deja el histórico en su tamaño: borra los más viejos mientras sobren. Se pide
 * desde la propia anotación, así que en condiciones normales sobra uno solo.
 */
async function prune(ctx: MutationCtx): Promise<void> {
  const rows = await ctx.db
    .query("mailLog")
    .withIndex("by_at")
    .order("asc")
    .take(MAIL_LOG_LIMIT + 50);
  const excess = rows.length - MAIL_LOG_LIMIT;
  if (excess <= 0) return;
  for (const row of rows.slice(0, excess)) {
    await ctx.db.delete(row._id);
  }
}

/**
 * Apunta un envío. Lo llama el único camino que manda correo
 * (`_mail/deliver`), también cuando no salió: un intento fallido con su motivo
 * es justo lo que se busca cuando alguien pregunta por qué no le llegó nada.
 */
export const record = internalMutation({
  args: {
    what: v.string(),
    origin: originValidator,
    provider: v.string(),
    to: v.array(v.string()),
    bcc: v.array(v.string()),
    subject: v.string(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("mailLog", {
      at: Date.now(),
      what: oneLine(args.what, 120),
      origin: args.origin,
      provider: args.provider,
      to: args.to,
      bcc: args.bcc,
      subject: oneLine(args.subject, 200),
      ok: args.ok,
      ...(args.error === undefined ? {} : { error: oneLine(args.error, 400) }),
      ...(args.relatedId === undefined ? {} : { relatedId: args.relatedId }),
    });
    await prune(ctx);
  },
});

/** Los últimos envíos, del más reciente al más viejo. Solo el administrador. */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, "ver el histórico de correos del taller");
    const want = Math.min(
      Math.max(Math.trunc(args.limit ?? 25), 1),
      MAIL_LOG_LIMIT,
    );
    return await ctx.db
      .query("mailLog")
      .withIndex("by_at")
      .order("desc")
      .take(want);
  },
});
