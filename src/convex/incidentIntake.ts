import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { MutationCtx } from "./_generated/server";
import { scheduleReporterEmail, scheduleStaffEmail } from "./incidentMail";
import { notifyUsers } from "./notify";
import { moderatorIds } from "./permissions";
import { freePublicCode } from "./publicCodes";
import { freeReference } from "./references";
import { assertReportImages } from "./reportUploads";
import {
  incidentIntakeNotice,
  incidentIntakeRecord,
  incidentIntakeReporterNotice,
  readIncidentIntake,
  type IncidentIntakeInput,
} from "../lib/incidentIntake";
import { INCIDENT_INTAKE_NOTICE } from "../lib/incidentMail";

/**
 * La mitad que habla con la base del alta de una incidencia: el camino por el que
 * entra todo lo que no viene del taller.
 *
 * El caso de uso —qué se admite, cómo queda la ficha, qué se avisa, si hay que
 * escribirle a quien notificó— vive en `lib/incidentIntake`, que no sabe de
 * Convex y se puede probar sin levantar nada. Aquí solo se trae y se lleva, en el
 * orden en que pasan las cosas:
 *
 * 1. **Las últimas altas**, que son el freno de quien insiste (el caso de uso las
 *    mira, no las escribe).
 * 2. **La referencia y el código**, que reparten sus módulos —`convex/references`
 *    y `convex/publicCodes`— porque son los que miran la tabla.
 * 3. **Las fotos**, que sube quien no tiene cuenta por el formulario público y se
 *    comprueban aquí contra lo que ese mismo formulario aceptó (`reportUploads`):
 *    la puerta abierta no vale para colar cualquier archivo.
 * 4. **El alta y el aviso**, que le llegan ya escritos al `ctx.db` y a la campana.
 * 5. **El correo**, por donde salen todos los demás avisos (`convex/incidentMail`).
 *
 * No exporta funciones de Convex a propósito, como `convex/references`: no es un
 * sitio al que llame el panel, sino la costura que usa la puerta pública
 * (`incidents.report`). Al partirse, lo que antes era un callback de sesenta
 * líneas con cinco responsabilidades es una puerta de tres y dos piezas que se
 * pueden leer por separado: la regla, donde no hay base de datos; el acceso, donde
 * no hay decisiones.
 */

/** Cuántas altas se miran para frenar al que insiste desde el mismo nombre. */
const RECENT_INTAKES = 100;

/**
 * Da de alta la incidencia y devuelve las dos caras del mismo caso: la referencia
 * con la que el taller la cita y el código con el que la sigue quien avisó.
 *
 * Lanza `ConvexError` con el motivo tal y como lo escribió el caso de uso —«Indica
 * tu nombre y apellidos», «espera 30 segundos antes de enviar otra»—, porque quien
 * lo lee es quien está rellenando el formulario: el motivo es el texto que se le
 * enseña en el panel público.
 */
export async function registerIncidentIntake(
  ctx: MutationCtx,
  input: IncidentIntakeInput,
  options: {
    /** Marca del borrador sin conexión, para reconocer un envío repetido. */
    clientDraftId?: string;
  } = {},
): Promise<{ reference: string; code: string }> {
  // Las últimas notificadas, solo para el freno: antes de repartir referencia
  // ninguna se mira si quien avisa acaba de avisar.
  const latest = await ctx.db
    .query("incidents")
    .withIndex("by_createdAt")
    .order("desc")
    .take(RECENT_INTAKES);

  const read = readIncidentIntake(input, { recent: latest });
  if (!read.ok) throw new ConvexError(read.error);
  const { intake } = read;

  await assertReportImages(ctx, intake.description);

  // La referencia es el número con el que el taller se cita entre sí («la
  // INC-0004»), así que no puede repetirse: la reparte la regla que comparten
  // todas las series, que mira la más alta ya repartida y avanza hasta la primera
  // libre. Y el código es con lo que la sigue quien notificó: al azar, sin
  // relación con el número, para que no se pueda ir probando.
  const reference = await freeReference(ctx, "incident");
  const publicCode = await freePublicCode(ctx);

  const now = Date.now();
  const incidentId = await ctx.db.insert(
    "incidents",
    incidentIntakeRecord(intake, { now, reference, publicCode }),
  );

  // La marca del borrador se apunta en la ficha ya creada: así el reintento de
  // mañana —o el de dentro de un minuto, si la red va y viene— encuentra el caso
  // por ella y no crea otro. No entra en el registro del alta porque no es un
  // dato del caso: es la forma de reconocer este envío.
  if (options.clientDraftId) {
    await ctx.db.patch(incidentId, { clientDraftId: options.clientDraftId });
  }

  // Aviso a los interesados: coordinadores del taller. Se excluye a quien notifica
  // si resulta ser del taller (una cuenta de dentro también puede avisar algo).
  const reporterUserId = await getAuthUserId(ctx);
  await notifyUsers(
    ctx,
    await moderatorIds(ctx),
    incidentIntakeNotice(intake, reference),
    incidentId,
    reporterUserId ?? undefined,
  );

  // Y el correo del alta: su código, para que no se quede en la pantalla que va a
  // cerrar. Sale por donde salen los demás avisos —que además no escriben a quien
  // no dejó correo— y la pregunta de si hay algo que contar la contesta el caso de
  // uso, que es quien sabe qué se cuenta por correo.
  const reporterNotice = incidentIntakeReporterNotice();
  const incident = await ctx.db.get(incidentId);
  if (reporterNotice !== null && incident) {
    await scheduleReporterEmail(ctx, incident, reporterNotice);
  }

  // Y el aviso interno al taller, por correo y a los roles que lo tengan marcado
  // en los ajustes. Va aparte del de quien notificó porque no cuenta lo mismo ni
  // se dirige a quien lo mismo: uno lleva el código del invitado, el otro la
  // referencia con la que el taller se cita. Aquí se manda el del alta; el de la
  // asignación y el del cierre salen de donde cambian esas cosas
  // (`convex/incidents`). Si no hay roles marcados, la acción lo deja pasar sin
  // componer nada.
  if (incident) {
    await scheduleStaffEmail(ctx, incident, INCIDENT_INTAKE_NOTICE);
  }

  return { reference, code: publicCode };
}
