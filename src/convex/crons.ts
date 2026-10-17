import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Archivado automático: una pasada cada noche (hora de poca actividad). Solo
 * manda al archivo lo ya terminado —incidencias cerradas y peticiones
 * decididas— anterior a la antigüedad configurada en el módulo Archivo, y no
 * borra nada: todo sigue consultable allí. El archivado a mano (masivo o ficha
 * a ficha) sigue disponible en cualquier momento.
 */
crons.daily(
  "archivar lo antiguo",
  { hourUTC: 3, minuteUTC: 15 },
  internal.archive.runAutoArchive,
  {},
);

/**
 * Aviso previo a la limpieza del formulario: quien gobierna el taller recibe lo
 * que hay pendiente —cuántas fotos, cuánto ocupan y qué vales sin archivo— para
 * no enterarse cuando ya no estén. Va unos minutos antes de la pasada y con la
 * misma cuenta que ella hace, así que el aviso no promete más de lo que la
 * pasada se va a llevar.
 */
crons.daily(
  "avisar de las fotos que se va a llevar la limpieza",
  { hourUTC: 3, minuteUTC: 45 },
  internal.reportUploads.warnUnused,
  {},
);

/**
 * Limpieza de las imágenes del formulario público: vales que nadie acreditó y
 * archivos que ninguna incidencia cita. Va de madrugada, después del archivado
 * automático y del aviso que la antecede, y no toca nada del expediente: solo lo
 * que nadie llegó a usar.
 */
crons.daily(
  "limpiar las imagenes sin usar",
  { hourUTC: 4, minuteUTC: 0 },
  internal.reportUploads.sweepUnused,
  {},
);

/**
 * Limpieza del almacén: archivos que ya no cita ninguna nota ni ninguna versión
 * —ni la descripción de una incidencia, ni un documento del expediente, ni el
 * adjunto de una petición—. Va después de la limpieza del formulario público,
 * que es la que mira los vales que nadie acreditó, y no toca nada que esté en
 * uso: solo lo que nadie menciona.
 */
crons.daily(
  "limpiar los archivos sin citar",
  { hourUTC: 4, minuteUTC: 30 },
  internal.storageCleanup.sweepOrphanFiles,
  {},
);

/**
 * Papelera del almacén: borra de verdad lo que cumplió su plazo sin que nadie
 * lo rescatara. Va después de las dos pasadas que retiran archivos —así la
 * papelera de esta noche ya está llena antes de mirar qué caduca— y no toca nada
 * más: lo rescatado a mano no caduca, y lo que sigue en uso no está aquí.
 */
crons.daily(
  "vaciar la papelera",
  { hourUTC: 5, minuteUTC: 0 },
  internal.trash.purgeExpired,
  {},
);

/**
 * Papelera de incidencias: borra de verdad las retiradas que cumplieron su
 * plazo sin que nadie las recuperara. Va después de la papelera del almacén y
 * comparte su plazo: es el mismo ajuste de «Ajustes del taller», el de lo que se
 * guarda antes de borrar. Lo retirado no se pierde mientras espera, y desde el
 * módulo Archivo se recupera en cualquier momento.
 */
crons.daily(
  "vaciar la papelera de incidencias",
  { hourUTC: 5, minuteUTC: 15 },
  internal.incidents.purgeExpired,
  {},
);

/**
 * Resumen semanal por correo: la pasada es diaria a propósito (temprano, antes
 * de que abra el taller) y es el propio trabajo el que decide si hoy toca: solo
 * envía el día de la semana que hay configurado en el panel. Así el día se
 * cambia desde la app sin tocar este horario.
 */
/**
 * Papelera de peticiones: borra de verdad las retiradas que cumplieron su plazo
 * sin que nadie las recuperara. Va después de la papelera de incidencias y
 * comparte su plazo —el mismo ajuste de «Ajustes del taller»—, y como ella no
 * toca nada más: lo que está dentro de plazo espera a su noche.
 */
crons.daily(
  "vaciar la papelera de peticiones",
  { hourUTC: 5, minuteUTC: 30 },
  internal.partRequests.purgeExpired,
  {},
);

/**
 * Purga del freno de la consulta pública: borra las ventanas caducadas de la
 * tabla que cuenta cuántas veces se sigue un código por hora. Va la última de
 * las purgas y no depende de ninguna otra pasada —ni ninguna depende de ella—:
 * una ventana caducada ya no frena a nadie, así que quitarla no cambia lo que
 * pasa en la puerta, solo lo que se guarda. Sin esta pasada, la tabla se quedaría
 * con todos los códigos seguidos alguna vez en vez de con los de la última hora.
 */
crons.daily(
  "borrar las ventanas caducadas",
  { hourUTC: 5, minuteUTC: 45 },
  internal.publicLookupLimits.purgeExpired,
  {},
);

crons.daily(
  "resumen semanal",
  { hourUTC: 7, minuteUTC: 0 },
  internal.weeklyReport.runScheduled,
  {},
);

/**
 * Las cifras públicas de la portada: una foto cada cuarto de hora.
 *
 * No son trabajo del taller sino lo que se enseña fuera, y por eso van por
 * intervalo y no por hora del día: quien abre la portada por la mañana no debe
 * ver los números de anoche. Cada pasada cuenta el catálogo y las incidencias
 * enteros, que es lo caro; hacerlo cada quince minutos deja esa cuenta fuera del
 * camino de las visitas, que solo leen la fila que esto escribe.
 */
crons.interval(
  "actualizar las cifras publicas",
  { minutes: 15 },
  internal.publicStats.refresh,
  {},
);

export default crons;
