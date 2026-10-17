import { describe, expect, test } from "vitest";
import {
  PENDING_PARTS_UNSPECIFIED,
  TRACKING_STATUS_NOTE,
  pendingPartWait,
  pendingPartsOldest,
  trackingAgeNote,
  trackingDuration,
  type PendingPart,
} from "../src/lib/incidentTracking";
import { INCIDENT_STATUSES } from "../src/convex/schema";

/**
 * Lo que la ficha de seguimiento explica: qué significa cada estado y cuánto
 * tiempo lleva —o tardó— el caso. Se prueba sin base de datos ni pantalla; lo que
 * el backend deja salir en el recorte lo prueban `tests/incidents.test.ts` y
 * `tests/guestAccess.test.ts`.
 */

const AHORA = Date.parse("2026-10-17T10:00:00.000Z");
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

describe("el tiempo del caso en la ficha de seguimiento", () => {
  test("lo que no llega a una hora no se redondea a cero", () => {
    // «0 horas» se lee como si no hubiera pasado nada, y «lleva abierta 0 días»
    // es peor: se dice tal cual.
    expect(trackingDuration(0)).toBe("menos de una hora");
    expect(trackingDuration(59 * 60 * 1000)).toBe("menos de una hora");
  });

  test("se cuenta en horas hasta el día, en singular y en plural", () => {
    expect(trackingDuration(HORA)).toBe("1 hora");
    expect(trackingDuration(2 * HORA)).toBe("2 horas");
    // Las horas se truncan, no se redondean: 2 h 59 min sigue siendo «2 horas».
    expect(trackingDuration(DIA - 1)).toBe("23 horas");
  });

  test("a partir del día se cuenta en días", () => {
    expect(trackingDuration(DIA)).toBe("1 día");
    expect(trackingDuration(3 * DIA)).toBe("3 días");
    expect(trackingDuration(DIA + HORA)).toBe("1 día");
  });

  test("abierto y cerrado no son la misma frase", () => {
    // Abierto mira hacia delante…
    expect(
      trackingAgeNote({
        reportedAt: AHORA - 3 * DIA,
        closedAt: null,
        now: AHORA,
      }),
    ).toBe("Lleva abierta 3 días.");
    // …y cerrado, hacia atrás: lo que tardó, no lo que lleva desde que se cerró.
    expect(
      trackingAgeNote({
        reportedAt: AHORA - 10 * DIA,
        closedAt: AHORA - 7 * DIA,
        now: AHORA,
      }),
    ).toBe("Se cerró 3 días después de notificarla.");
  });

  test("un reloj desajustado no produce tiempos negativos", () => {
    // La fecha de cierre es de quien escribe en la ficha; el «ahora» de la
    // pantalla. Si el reloj del navegador va por detrás, la frase no puede salir
    // con un menos delante.
    expect(
      trackingAgeNote({ reportedAt: AHORA + DIA, closedAt: null, now: AHORA }),
    ).toBe("Lleva abierta menos de una hora.");
    expect(
      trackingAgeNote({
        reportedAt: AHORA,
        closedAt: AHORA - DIA,
        now: AHORA,
      }),
    ).toBe("Se cerró menos de una hora después de notificarla.");
  });
});

describe("los repuestos que el caso espera", () => {
  /** Un repuesto pendiente, con su fecha desplazada desde «ahora». */
  const pedido = (
    name: string,
    quantity: number,
    dias: number,
  ): PendingPart => ({
    name,
    quantity,
    since: AHORA - dias * DIA,
  });

  test("cada repuesto dice desde cuándo espera, con la escala del caso", () => {
    // La ficha no puede decir «lleva abierta 3 días» arriba y «72 horas» abajo:
    // las dos cuentas usan la misma escala.
    expect(pendingPartWait(AHORA - 3 * DIA, AHORA)).toBe("pedido hace 3 días");
    expect(pendingPartWait(AHORA - 2 * HORA, AHORA)).toBe(
      "pedido hace 2 horas",
    );
    expect(pendingPartWait(AHORA - 5 * 60 * 1000, AHORA)).toBe(
      "pedido hace menos de una hora",
    );
    // Un reloj desajustado no produce un «hace -1 días».
    expect(pendingPartWait(AHORA + DIA, AHORA)).toBe(
      "pedido hace menos de una hora",
    );
  });

  test("el más antiguo es el que lleva más tiempo sin llegar, no el último pedido", () => {
    // Lo que se quiere saber cuando se pregunta «¿cuándo llega?» es desde cuándo
    // falta la primera pieza, no la que se pidió ayer.
    expect(
      pendingPartsOldest([
        pedido("Fuente de alimentación 12 V", 2, 1),
        pedido("Filtro de aire", 1, 6),
        pedido("Cable HDMI 2 m", 3, 2),
      ]),
    ).toBe(AHORA - 6 * DIA);
    // Sin repuestos pendientes no hay fecha que enseñar.
    expect(pendingPartsOldest([])).toBeNull();
  });

  test("sin líneas que enseñar se dice, en vez de dejar el hueco en blanco", () => {
    // Una petición abierta describiendo la avería, con el repuesto aún sin
    // asociar: el caso espera material y la ficha tiene que explicarlo.
    expect(PENDING_PARTS_UNSPECIFIED.trim()).not.toBe("");
    expect(PENDING_PARTS_UNSPECIFIED).toContain("repuestos");
    // Y escrita para quien avisó: sin referencias internas.
    expect(PENDING_PARTS_UNSPECIFIED).not.toMatch(/(INC|PET)-\d/);
  });
});

describe("qué significa el estado para quien consulta", () => {
  test("todos los estados tienen su explicación", () => {
    // Un estado nuevo sin frase dejaría la ficha con el hueco en blanco justo
    // donde hay que explicar qué pasa: el tipo lo impide al compilar, y esto lo
    // vuelve a mirar al ejecutar los datos del esquema.
    for (const status of Object.values(INCIDENT_STATUSES)) {
      const note = TRACKING_STATUS_NOTE[status];
      expect(note, status).toBeTypeOf("string");
      expect(note.trim(), status).not.toBe("");
      // Y está escrita para quien avisó, no para el taller: sin referencias
      // internas ni nombres de pasos del flujo.
      expect(note, status).not.toMatch(/INC-\d/);
    }
  });

  test("los dos cierres dicen qué hacer después", () => {
    // Resuelta y sin resolución son el final del caso: lo que se pregunta
    // entonces es qué pasa si vuelve a ocurrir.
    expect(TRACKING_STATUS_NOTE.resolved).toContain("cerrado");
    expect(TRACKING_STATUS_NOTE.unresolved).toContain("notifícalo otra vez");
  });
});
