import {
  meanWindowStart,
  publishedMeanMinutes,
  resolutionMinutes,
} from "../lib/workshopStats";
import { isClosedIncident } from "../lib/incidentFlow";
import { internalMutation, query } from "./_generated/server";

/**
 * Las cifras del taller que la portada enseña a quien no ha entrado nunca.
 *
 * Dos piezas y una regla entre ellas: la foto la toma `refresh` —un trabajo
 * interno, sin sesión pero sin puerta, que mueve el cron— y `summary` se limita
 * a leerla. La portada llama a `summary`, que cuesta una lectura, y nunca a
 * `refresh`, que cuenta el taller entero.
 *
 * Por qué una foto y no una consulta que cuente al vuelo: equipos, repuestos e
 * incidencias se cuentan leyendo sus tablas, y esta página está abierta a
 * internet. Una consulta que recorre tres tablas en cada visita es una puerta
 * que se puede llamar sin freno desde fuera; una que lee una fila es una puerta
 * que no. El precio es que los números pueden ir hasta quince minutos por
 * detrás del trabajo real, y por eso la portada dice cuándo se tomaron.
 *
 * Qué se publica y qué no: solo agregados. Ni un nombre, ni una referencia, ni
 * un código de seguimiento, ni una ubicación salen de aquí; y la media del
 * tiempo de cierre solo se publica a partir de cinco casos cerrados, porque por
 * debajo de eso la media sería la duración exacta de un trabajo concreto (la
 * regla vive en `lib/workshopStats`, con la ventana y el redondeo).
 */

/** La clave de la fila única. */
const KEY = "taller";

/**
 * Lo que la portada puede leer: seis números y una fecha.
 *
 * Se devuelve campo a campo, no la fila entera, para que una columna nueva del
 * esquema no se publique sola: lo que sale de aquí es una lista blanca.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("publicStats")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    // Sin foto todavía (instalación recién puesta, cron sin estrenar) la
    // portada enseña guiones en vez de ceros: no es lo mismo «no hay» que «aún
    // no se ha contado».
    if (row === null) return null;
    return {
      equipment: row.equipment,
      spareParts: row.spareParts,
      openIncidents: row.openIncidents,
      closedLastMonth: row.closedLastMonth,
      meanResolutionMinutes: row.meanResolutionMinutes,
      computedAt: row.computedAt,
    };
  },
});

/**
 * Toma la foto: cuenta el taller y la guarda.
 *
 * Lee entero el catálogo y la tabla de incidencias porque es la única forma de
 * contar sin llevar contadores a mano por todas las pantallas que escriben, y
 * se lo puede permitir porque lo hace cada quince minutos y no una vez por
 * visitante. Lo retirado no cuenta; lo archivado sí cuenta si está cerrado (el
 * archivo mueve casos viejos de sitio, no los borra), y del archivo solo se
 * mira la incidencia, que es donde está su estado.
 */
export const refresh = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const since = meanWindowStart(now);

    // Equipos dados de alta y en servicio: un equipo de baja ya no está en el
    // taller, aunque su ficha siga en el catálogo.
    const equipment = (await ctx.db.query("equipment").collect()).filter(
      (row) => row.decommissionDate === undefined,
    ).length;

    const spareParts = (await ctx.db.query("spareParts").collect()).length;

    const incidents = await ctx.db.query("incidents").collect();
    // La papelera no cuenta: una incidencia retirada espera a borrarse y no es
    // trabajo del taller mientras tanto.
    const live = incidents.filter((row) => row.deletedAt === undefined);

    const openIncidents = live.filter(
      (row) => row.archivedAt === undefined && !isClosedIncident(row.status),
    ).length;

    const closedLastMonth = live.filter(
      (row) => isClosedIncident(row.status) && (row.closedAt ?? 0) >= since,
    );

    const resolutions = closedLastMonth
      .map(resolutionMinutes)
      .filter((minutes): minutes is number => minutes !== null);

    const figures = {
      equipment,
      spareParts,
      openIncidents,
      closedLastMonth: closedLastMonth.length,
      meanResolutionMinutes: publishedMeanMinutes(resolutions),
      computedAt: now,
    };

    const row = await ctx.db
      .query("publicStats")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    if (row === null) {
      await ctx.db.insert("publicStats", { key: KEY, ...figures });
    } else {
      await ctx.db.patch(row._id, figures);
    }

    return figures;
  },
});
