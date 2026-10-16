import { describe, expect, test } from "vitest";
import {
  INTAKE_COOLDOWN_MS,
  INTAKE_STATUS,
  incidentIntakeNotice,
  incidentIntakeRecord,
  incidentIntakeReporterNotice,
  readIncidentIntake,
  type IncidentIntakeInput,
} from "../src/lib/incidentIntake";
import { mailNotice } from "../src/lib/incidentMail";
import { richDocToPlainText } from "../src/lib/richDoc";

/**
 * El caso de uso del alta de una incidencia, sin Convex delante: las reglas del
 * formulario público —qué se admite, cómo queda la ficha, qué se avisa y si hay
 * que escribirle a quien notificó— contadas aquí, que es donde se pueden probar
 * sin levantar la base de datos. El reparto de la referencia y el código, el alta
 * de verdad y el aviso en la campana se prueban por su puerta, en
 * `tests/incidents.test.ts`.
 */

/** Un aviso del formulario con lo mínimo, para variar un campo por caso. */
const intakeArgs: IncidentIntakeInput = {
  reporterName: "Laura Peña",
  reporterRole: "Realización",
  reporterEmail: "Laura.Pena@Taller.ES",
  location: "Plató 1",
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: "HDC3500-2505-0147",
  description: "La cámara se apaga sola en directo cuando se mueve el cable.",
  reportedAt: 1_700_000_000_000,
};

/** Un instante de referencia: la fecha del aviso y el «ahora» de quien lo lee. */
const AHORA = intakeArgs.reportedAt + 60 * 60 * 1000;

/** El motivo con el que el formulario no admite este aviso. */
function errorOf(
  input: Partial<IncidentIntakeInput>,
  recent: { reporterName: string; createdAt: number }[] = [],
): string {
  const read = readIncidentIntake(
    { ...intakeArgs, ...input },
    { now: AHORA, recent },
  );
  if (read.ok) throw new Error("Se esperaba un motivo y el aviso se admitió.");
  return read.error;
}

/** El aviso ya en limpio, para poder mirarlo por dentro. */
function intakeOf(input: Partial<IncidentIntakeInput> = {}) {
  const read = readIncidentIntake({ ...intakeArgs, ...input }, { now: AHORA });
  if (!read.ok) throw new Error(`Se esperaba un alta y no: ${read.error}`);
  return read.intake;
}

/** Los bloques del editor, tal y como los guarda la descripción. */
function docOf(...texts: string[]): string {
  return JSON.stringify(
    texts.map((text) => ({ type: "paragraph", inline: [{ text }] })),
  );
}

describe("lo que se admite en el formulario público de incidencias", () => {
  test("recorta lo que se teclea y no guarda campos vacíos", () => {
    const intake = intakeOf({
      reporterName: "  Laura Peña  ",
      reporterRole: "   ",
      location: "  Plató 1  ",
      serialNumber: "   ",
      model: " HDC-3500 ",
    });

    expect(intake.reporterName).toBe("Laura Peña");
    expect(intake.location).toBe("Plató 1");
    expect(intake.model).toBe("HDC-3500");
    // Un campo que se dejó en blanco no viaja a la ficha: ni «Realización» con
    // espacios ni un número de serie vacío. La ficha enseña lo que hay.
    expect("reporterRole" in intake).toBe(false);
    expect("serialNumber" in intake).toBe(false);
  });

  test("los motivos van en el orden en el que se rellena el formulario", () => {
    const vacío: Partial<IncidentIntakeInput> = {
      reporterName: " ",
      reporterEmail: "no-es-un-correo",
      description: "corta",
    };

    // Con todo mal, lo primero que se pide es el nombre, y según se arregla cada
    // campo la queja pasa al siguiente: quien rellena el formulario no ve seis
    // errores a la vez, ve el que le toca.
    expect(errorOf(vacío)).toBe("Indica tu nombre y apellidos.");
    expect(
      errorOf({
        ...vacío,
        reporterName: "Laura Peña",
      }),
    ).toContain("no parece una dirección válida");
    expect(
      errorOf({
        ...vacío,
        reporterName: "Laura Peña",
        reporterEmail: "laura@taller.es",
      }),
    ).toContain("mínimo 10 caracteres");
  });

  test("el tipo de equipo y el modelo son opcionales", () => {
    const intake = intakeOf({
      equipmentKind: undefined,
      model: undefined,
    });
    expect("equipmentKind" in intake).toBe(false);
    expect("model" in intake).toBe(false);
  });

  test("el correo es opcional, pero si se deja tiene que servir para responder", () => {
    // Sin correo se avisa igual: avisar de una avería no puede exigir dejar datos
    // de contacto. Y se guarda en minúsculas, que es como se escribe a alguien.
    expect("reporterEmail" in intakeOf({ reporterEmail: "   " })).toBe(false);
    expect(intakeOf().reporterEmail).toBe("laura.pena@taller.es");
    // Una errata de dedo se para aquí, que es cuando se puede corregir, y no
    // semanas después con el correo rebotado sin que nadie lo vea.
    expect(errorOf({ reporterEmail: "laura.pena@taller" })).toContain(
      "no parece una dirección válida",
    );
  });

  test("el mínimo de la descripción se cuenta sobre lo que dice, no sobre su formato", () => {
    // Del editor llega un documento —párrafos, listas, marcas— y así se guarda:
    // el mínimo mira el texto, así que «se apaga» con formato sigue siendo corto.
    expect(
      errorOf({
        description: docOf("Se apaga"),
      }),
    ).toContain("mínimo 10 caracteres");
    // Y un documento sin nada escrito no cuela aunque venga bien formado...
    expect(errorOf({ description: docOf("   ") })).toContain(
      "mínimo 10 caracteres",
    );
    // ...ni una descripción que solo sea una foto: la foto enseña el golpe, no
    // cuenta qué pasa, y quien la lee no sabe qué se ha roto.
    expect(
      errorOf({
        description: JSON.stringify([
          { type: "image", src: "https://taller.es/foto.jpg" },
        ]),
      }),
    ).toContain("mínimo 10 caracteres");

    // Lo que sí pasa se guarda como documento, sin los párrafos vacíos de sobra.
    const intake = intakeOf({
      description: docOf("La cámara se apaga sola en directo.", "   "),
    });
    expect(richDocToPlainText(intake.description)).toBe(
      "La cámara se apaga sola en directo.",
    );
    // Y una descripción de las de antes —texto plano— se guarda tal cual: pasar
    // por bloques un texto sin bloques no añadiría nada.
    expect(
      intakeOf({ description: "  Se apaga sola al mover el cable.  " })
        .description,
    ).toBe("Se apaga sola al mover el cable.");
  });

  test("la fecha del aviso no puede ir por delante del reloj", () => {
    // Un desfase de reloj entre el móvil de quien avisa y el servidor es normal:
    // se admite un día de holgura, y a partir de ahí es una fecha mal puesta.
    expect(
      intakeOf({ reportedAt: AHORA + 24 * 60 * 60 * 1000 }).reportedAt,
    ).toBe(AHORA + 24 * 60 * 60 * 1000);
    expect(errorOf({ reportedAt: AHORA + 24 * 60 * 60 * 1000 + 1 })).toBe(
      "La fecha de notificación no puede ser futura.",
    );
  });

  test("el freno de 30 segundos es de quien escribe, no de la cola entera", () => {
    const reciente = [
      { reporterName: "Laura Peña", createdAt: AHORA - 5 * 1000 },
    ];
    // El mismo nombre —aunque cambie de mayúsculas— no vuelve a colar dentro de la
    // ventana: sin el freno, una misma persona puede inundar la cola.
    expect(errorOf({ reporterName: "laura peña" }, reciente)).toContain(
      "espera 30 segundos",
    );
    // Pasada la ventana, sí; y otra persona, también en el mismo momento.
    const justo = [
      { reporterName: "Laura Peña", createdAt: AHORA - INTAKE_COOLDOWN_MS },
    ];
    expect(
      readIncidentIntake(intakeArgs, { now: AHORA, recent: justo }).ok,
    ).toBe(true);
    expect(
      readIncidentIntake(
        { ...intakeArgs, reporterName: "Marta Ruiz" },
        { now: AHORA, recent: reciente },
      ).ok,
    ).toBe(true);
  });
});

describe("la ficha que queda de un aviso recién notificado", () => {
  test("nace notificada, con su primer paso de historial y sus dos identificadores", () => {
    const intake = intakeOf();
    const record = incidentIntakeRecord(intake, {
      now: AHORA,
      reference: "INC-0007",
      publicCode: "A7K2QX9M",
    });

    expect(record.reference).toBe("INC-0007");
    expect(record.publicCode).toBe("A7K2QX9M");
    expect(record.status).toBe(INTAKE_STATUS);
    expect(record.status).toBe("reported");
    // El historial empieza con el propio aviso, fechado cuando pasó —no cuando se
    // leyó— y firmado por quien lo notificó: es quien abre el caso.
    expect(record.history).toEqual([
      { status: "reported", at: intake.reportedAt, by: "Laura Peña" },
    ]);
    expect(record.createdAt).toBe(AHORA);
    expect(record.updatedAt).toBe(AHORA);
  });

  test("lo que no se escribió no se guarda como campo vacío", () => {
    // Sin correo ni ubicación la ficha no lleva un correo en blanco: la ficha, el
    // aviso por correo y el recorte que se enseña fuera leen «hay algo» o «no hay
    // nada», no un hueco que hay que distinguir de un dato.
    const sinDatos = incidentIntakeRecord(
      intakeOf({ reporterEmail: "  ", location: "", reporterRole: "" }),
      { now: AHORA, reference: "INC-0001", publicCode: "A7K2QX9M" },
    );
    expect("reporterEmail" in sinDatos).toBe(false);
    expect("location" in sinDatos).toBe(false);
    expect("reporterRole" in sinDatos).toBe(false);

    const conDatos = incidentIntakeRecord(intakeOf(), {
      now: AHORA,
      reference: "INC-0002",
      publicCode: "B8L3RY0N",
    });
    expect(conDatos.reporterEmail).toBe("laura.pena@taller.es");
    expect(conDatos.location).toBe("Plató 1");
    expect(conDatos.reporterRole).toBe("Realización");
  });
});

describe("el aviso de una incidencia nueva", () => {
  test("una línea con la referencia y el equipo, con dónde está y sin la ficha detrás", () => {
    expect(incidentIntakeNotice(intakeOf(), "INC-0004")).toBe(
      "Nueva incidencia INC-0004: Cámara de estudio HDC-3500 · Plató 1",
    );
    // Sin ubicación no arrastra el separador suelto...
    const sinUbicacion = incidentIntakeNotice(
      intakeOf({ location: "  " }),
      "INC-0005",
    );
    expect(sinUbicacion).toBe(
      "Nueva incidencia INC-0005: Cámara de estudio HDC-3500",
    );
    // ...y lo que se cuenta es a quién hay que ir a mirar y dónde, no la avería
    // entera: el aviso lleva a la ficha, la descripción se lee allí.
    expect(sinUbicacion).not.toContain("apaga sola");
  });
});

describe("el correo del alta", () => {
  test("manda el código, y lo decide la misma puerta que los demás avisos", () => {
    // El alta sí se cuenta: es el correo que lleva el código a quien avisó, para
    // que no se quede solo en la pantalla que va a cerrar.
    expect(incidentIntakeReporterNotice()).toBe("reported");
    // Y no es una decisión escrita aquí: sale de la misma puerta que todos los
    // avisos, así que el día que el alta deje de contarse —o se cuente otra cosa—
    // esto lo dice solo, sin tocar el caso de uso.
    expect(incidentIntakeReporterNotice()).toBe(mailNotice(INTAKE_STATUS));
    expect(mailNotice("assigned")).toBe("assigned");
  });
});
