/**
 * El alta de una incidencia, como caso de uso: lo que se comprueba, la ficha que
 * queda escrita, el aviso al taller y el correo de quien notifica.
 *
 * Es la puerta por la que entra todo lo que no viene del taller —quien avisa de
 * una avería no tiene cuenta—, así que aquí no se decide quién puede hacerlo (eso
 * son capacidades, en `lib/permissions`), sino si lo que llega se puede dar de
 * alta y cómo queda. Cinco cosas, en el orden en que pasan:
 *
 * 1. **Validación** (`readIncidentIntake`): recorta lo que se tecleó, normaliza el
 *    correo, cuenta el mínimo de la descripción sobre lo que dice —no sobre su
 *    marcado— y frena al que insiste.
 * 2. **Referencia y código**: los reparte el adaptador, que es quien mira la base
 *    (`convex/references`, `convex/publicCodes`); aquí llegan hechos. La regla de
 *    cada serie vive en su módulo puro; esto solo los coloca.
 * 3. **Alta** (`incidentIntakeRecord`): el documento que se inserta, con su
 *    historial de un paso y su estado inicial.
 * 4. **Aviso** (`incidentIntakeNotice`): lo que lee el taller en la campana.
 * 5. **Correo** (`incidentIntakeReporterNotice`): si hay que escribirle a quien
 *    notificó ahora mismo —su código de seguimiento, en el alta—, decidido con
 *    la misma puerta que el resto de avisos (`lib/incidentMail`).
 *
 * Antes las cinco vivían en el mismo callback (`convex/incidents.report`),
 * mezcladas con la base de datos: validar, repartir número y código, insertar,
 * avisar y dejar el correo eran un solo bloque de sesenta líneas que no se podía
 * probar sin levantar Convex. Ahora el caso de uso vive aquí, con las mismas
 * reglas pero contadas en su sitio, y el adaptador solo trae y lleva: pide la
 * referencia y el código, comprueba que las fotos son las que ese formulario
 * aceptó (`convex/reportUploads`), pregunta aquí y escribe.
 *
 * Igual que `lib/references` y la máquina de estados (`lib/incidentFlow`): la
 * decisión, fuera; el `ctx.db`, fuera del módulo.
 */

import {
  looksLikeEmail,
  mailNotice,
  normalizeReporterEmail,
  type IncidentMailNotice,
} from "./incidentMail";
import { richDocToPlainText, richDocToStore } from "./richDoc";
import type { IncidentStatus } from "./workshop";

/** El estado con el que nace una incidencia: notificada, sin asignar. */
export const INTAKE_STATUS: IncidentStatus = "reported";

/** Lo que hay que esperar entre dos avisos de la misma persona (30 segundos). */
export const INTAKE_COOLDOWN_MS = 30_000;

/** Mínimo de lo que se lee en la descripción, sin contar el marcado del editor. */
export const INTAKE_MIN_DESCRIPTION = 10;

/** Margen de la fecha de notificación: no se admite el futuro (un día de holgura). */
export const INTAKE_FUTURE_MARGIN_MS = 24 * 60 * 60 * 1000;

/** Lo que manda el formulario público, tal cual llega. */
export interface IncidentIntakeInput {
  reporterName: string;
  reporterRole?: string;
  /** Correo de quien notifica, si lo deja. Opcional a propósito. */
  reporterEmail?: string;
  location?: string;
  equipmentKind: string;
  model: string;
  serialNumber?: string;
  /** La descripción tal cual sale del editor (documento de `richDoc`). */
  description: string;
  reportedAt: number;
}

/**
 * Lo que manda el formulario, ya en limpio: sin espacios de sobra, sin campos
 * vacíos a medias y con la descripción guardable.
 */
export interface IncidentIntake {
  reporterName: string;
  reporterRole?: string;
  reporterEmail?: string;
  location?: string;
  equipmentKind: string;
  model: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
}

/**
 * Una incidencia ya dada de alta, con lo justo para el freno de quien insiste:
 * quién la notificó y cuándo entró.
 */
export interface RecentIncident {
  reporterName: string;
  createdAt: number;
}

/** Lo que sale de leer el formulario: el alta en limpio, o el motivo de no serlo. */
export type IncidentIntakeRead =
  { ok: true; intake: IncidentIntake } | { ok: false; error: string };

/** Un campo de texto que se guarda recortado, o nada si no se escribió. */
function clean(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

/** ¿Acaba de notificar esta misma persona? El freno que cierra la puerta abierta. */
function intakeTooSoon(
  recent: readonly RecentIncident[],
  reporterName: string,
  now: number,
): boolean {
  const name = reporterName.toLowerCase();
  return recent.some(
    (item) =>
      item.reporterName.toLowerCase() === name &&
      item.createdAt > now - INTAKE_COOLDOWN_MS,
  );
}

/**
 * Lee lo que llega del formulario: recorta, normaliza y comprueba, y devuelve el
 * alta en limpio o el motivo por el que no la hay. El motivo se escribe para que
 * lo lea quien está rellenando el formulario, que es a quien se le enseña.
 *
 * El correo es opcional —avisar sin cuenta no debe exigir dejar datos de
 * contacto—, pero si se escribe tiene que servir para responder: una errata de
 * dedo se avisa aquí, que es cuando todavía se puede corregir, y no cuando el
 * correo se rebota semanas después sin que nadie lo vea.
 *
 * `recent` es lo último que ha entrado (el adaptador pasa las últimas altas): es
 * lo que hace falta para saber si esta persona acaba de notificar otra cosa.
 */
export function readIncidentIntake(
  input: IncidentIntakeInput,
  options: { now?: number; recent?: readonly RecentIncident[] } = {},
): IncidentIntakeRead {
  const now = options.now ?? Date.now();
  const reporterName = input.reporterName.trim();
  if (!reporterName) {
    return { ok: false, error: "Indica tu nombre y apellidos." };
  }
  const equipmentKind = input.equipmentKind.trim();
  if (!equipmentKind) {
    return { ok: false, error: "Indica el tipo de equipo." };
  }
  const model = input.model.trim();
  if (!model) {
    return { ok: false, error: "Indica el modelo del equipo." };
  }
  const rawEmail = clean(input.reporterEmail);
  const reporterEmail =
    rawEmail === undefined ? undefined : normalizeReporterEmail(rawEmail);
  if (reporterEmail !== undefined && !looksLikeEmail(reporterEmail)) {
    return {
      ok: false,
      error:
        "Ese correo no parece una dirección válida. Revísalo o déjalo en blanco.",
    };
  }
  // La descripción viene como documento del editor (párrafos, listas, imágenes) y
  // así se guarda; el mínimo se cuenta sobre lo que dice, no sobre su estructura
  // (si no, un documento sin texto colaría).
  const description = richDocToStore(input.description);
  if (
    description === undefined ||
    richDocToPlainText(description).length < INTAKE_MIN_DESCRIPTION
  ) {
    return {
      ok: false,
      error:
        "Describe la incidencia con un poco más de detalle (mínimo 10 caracteres).",
    };
  }
  if (input.reportedAt > now + INTAKE_FUTURE_MARGIN_MS) {
    return {
      ok: false,
      error: "La fecha de notificación no puede ser futura.",
    };
  }
  if (intakeTooSoon(options.recent ?? [], reporterName, now)) {
    return {
      ok: false,
      error:
        "Ya has notificado una incidencia recientemente. Por favor, espera 30 segundos antes de enviar otra.",
    };
  }
  const reporterRole = clean(input.reporterRole);
  const location = clean(input.location);
  const serialNumber = clean(input.serialNumber);
  return {
    ok: true,
    intake: {
      reporterName,
      description,
      reportedAt: input.reportedAt,
      equipmentKind,
      model,
      ...(reporterRole !== undefined ? { reporterRole } : {}),
      ...(reporterEmail !== undefined ? { reporterEmail } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(serialNumber !== undefined ? { serialNumber } : {}),
    },
  };
}

/** Un paso del historial: a qué estado, cuándo y quién lo dio. */
export interface IntakeHistoryEntry {
  status: IncidentStatus;
  at: number;
  by: string;
}

/**
 * La incidencia que se inserta: lo que se guarda de un aviso recién notificado.
 * Los campos opcionales solo van si están —una ficha sin correo no lleva un
 * correo vacío—, que es como los lee después la ficha y el aviso por correo.
 */
export interface IncidentIntakeRecord {
  reference: string;
  publicCode: string;
  reporterName: string;
  reporterRole?: string;
  reporterEmail?: string;
  location?: string;
  equipmentKind: string;
  model: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
  status: IncidentStatus;
  history: IntakeHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Escribe el alta: la ficha que queda de un aviso, con la referencia y el código
 * que le ha repartido el adaptador, su estado inicial y el primer paso de su
 * historial —el aviso de quien la notificó, que es quien la abre—.
 */
export function incidentIntakeRecord(
  intake: IncidentIntake,
  options: { now: number; reference: string; publicCode: string },
): IncidentIntakeRecord {
  return {
    reference: options.reference,
    publicCode: options.publicCode,
    reporterName: intake.reporterName,
    ...(intake.reporterRole !== undefined
      ? { reporterRole: intake.reporterRole }
      : {}),
    ...(intake.reporterEmail !== undefined
      ? { reporterEmail: intake.reporterEmail }
      : {}),
    ...(intake.location !== undefined ? { location: intake.location } : {}),
    equipmentKind: intake.equipmentKind,
    model: intake.model,
    ...(intake.serialNumber !== undefined
      ? { serialNumber: intake.serialNumber }
      : {}),
    description: intake.description,
    reportedAt: intake.reportedAt,
    status: INTAKE_STATUS,
    history: [
      {
        status: INTAKE_STATUS,
        at: intake.reportedAt,
        by: intake.reporterName,
      },
    ],
    createdAt: options.now,
    updatedAt: options.now,
  };
}

/**
 * El aviso que lee el taller en su campana: la referencia —lo que se cita—, el
 * equipo y dónde está. Ni quién lo notificó ni la descripción entera: eso se lee
 * en la ficha, y en un aviso solo estorba.
 */
export function incidentIntakeNotice(
  intake: IncidentIntake,
  reference: string,
): string {
  const where = intake.location ? ` · ${intake.location}` : "";
  return `Nueva incidencia ${reference}: ${intake.equipmentKind} ${intake.model}${where}`;
}

/**
 * El correo del alta: su código de seguimiento.
 *
 * Es lo que impide que el código se quede en la pantalla que quien avisa va a
 * cerrar: se le manda al correo que dejó —si lo dejó— para que pueda volver al
 * caso cuando quiera. Sin esto, quien avisa y cierra el navegador se queda sin
 * nada con lo que preguntar, y los avisos de los cambios de estado tampoco le
 * sirven de nada, porque tampoco los tendría.
 *
 * La respuesta se pide a la misma puerta que todos los avisos (`mailNotice`), no
 * se escribe aquí a mano: el alta es un estado de la ficha y se cuenta por donde
 * se cuentan los demás. El adaptador recoge lo que salga de aquí y escribe por
 * donde escribe el resto, que además no manda nada a quien no dejó correo.
 */
export function incidentIntakeReporterNotice(): IncidentMailNotice | null {
  return mailNotice(INTAKE_STATUS);
}
