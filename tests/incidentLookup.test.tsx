// @vitest-environment jsdom
// Se sustituyen el backend y los hooks de Convex *antes* de que el componente los
// importe: aquí se comprueba la pantalla de consulta del invitado —que enseña lo
// que le llega y calla lo que le falta—, no la consulta en sí (esa está en
// tests/incidents.test.ts y tests/guestAccess.test.ts).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const estado = vi.hoisted(() => ({
  /** Las consultas que la pantalla ha pedido, ya en su forma canónica. */
  consultas: [] as string[],
  /** Lo que el backend contesta a la última: el seguimiento o `null`. */
  respuesta: undefined as unknown,
  /** El freno de la puerta, si lo hay: el texto que lanza el backend. */
  freno: null as string | null,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { incidents: { byCode: { nombre: "incidents.byCode" } } },
}));

// La consulta es una mutación: cada vez que se pide se apunta —y se cuenta, que
// es lo que la limita a treinta por hora y código—, y contesta el seguimiento,
// `null` o el freno.
vi.mock("convex/react", () => ({
  useMutation: () => async (args: { code: string }) => {
    estado.consultas.push(JSON.stringify(args));
    if (estado.freno !== null) throw new Error(estado.freno);
    return estado.respuesta;
  },
}));

import { IncidentLookup } from "@/pages/dashboard/IncidentLookup";

let container: HTMLDivElement;
let root: Root;

/** El código de la incidencia que se sigue en estas pruebas. */
const CODIGO = "A7K2QX9M";

beforeAll(() => {
  // Sin esto React avisa en cada `act`: jsdom no es un navegador y hay que
  // decirle que las actualizaciones son las de una prueba.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

// Montar con el código en la dirección dispara la consulta al abrir, que es
// asíncrona: se espera a que conteste para que la prueba vea lo que ve quien
// llega desde el correo.
const montar = async (initialCode?: string | null) => {
  await act(async () => {
    root.render(<IncidentLookup initialCode={initialCode} />);
  });
};

beforeEach(async () => {
  estado.consultas.length = 0;
  estado.respuesta = undefined;
  estado.freno = null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await montar();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Escribe en el campo como si se tecleara, para que React lo note. */
function escribir(texto: string) {
  const campo = container.querySelector("input") as HTMLInputElement;
  act(() => {
    const escribirValor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    escribirValor?.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Escribe el código y pulsa «Consultar», como quien tiene el correo delante. */
async function consultar(texto: string) {
  escribir(texto);
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const texto = () => container.textContent ?? "";

/** El seguimiento que devuelve el backend para una incidencia en curso. */
const seguimiento = {
  code: CODIGO,
  status: "assigned" as const,
  equipmentKind: "Cámara de estudio",
  model: "HDC-3500",
  serialNumber: "HDC3500-2505-0147",
  location: "Plató 1",
  description: "La cámara se apaga sola en directo cuando se mueve el cable.",
  reportedAt: Date.parse("2026-10-01T09:00:00.000Z"),
  closedAt: null,
  assigneeName: "Iván Torres",
  workshopAssigneeName: null,
  history: [
    { status: "reported" as const, at: Date.parse("2026-10-01T09:00:00.000Z") },
    { status: "assigned" as const, at: Date.parse("2026-10-01T10:00:00.000Z") },
  ],
};

describe("IncidentLookup — seguir una incidencia por su código", () => {
  test("el código se teclee como se teclee, se consulta en su forma canónica", async () => {
    // Lo que se escribe de verdad: el código del correo, en minúsculas, sin los
    // guiones o con un espacio de más.
    for (const typed of [CODIGO, "a7k2qx9m", "A7K2-QX9M", " a7k2 qx9m "]) {
      estado.consultas.length = 0;
      await consultar(typed);
      expect(estado.consultas, `«${typed}»`).toEqual([`{"code":"${CODIGO}"}`]);
    }
  });

  test("el seguimiento llega a la pantalla con su paso a paso", async () => {
    estado.respuesta = seguimiento;
    await consultar(CODIGO);

    // El código se enseña como se dicta, en dos grupos.
    expect(texto()).toContain("A7K2-QX9M");
    expect(texto()).toContain("Asignada");
    expect(texto()).toContain("Cámara de estudio · HDC-3500");
    expect(texto()).toContain("Plató 1");
    expect(texto()).toContain("HDC3500-2505-0147");
    expect(texto()).toContain("Iván Torres");
    expect(texto()).toContain("La cámara se apaga sola en directo");
    // El paso a paso: lo que ha pasado y cuándo, sin quién lo dio.
    expect(texto()).toContain("Nueva");
  });

  test("la ficha explica qué significa el estado y detalla desde cuándo", async () => {
    estado.respuesta = seguimiento;
    await consultar(CODIGO);

    // El nombre del estado no basta: se dice qué implica para quien avisó y
    // cuánto lleva el caso abierto.
    expect(texto()).toContain("Ya hay un técnico encargado del caso");
    expect(texto()).toContain("Lleva abierta");
    // …y desde cuándo está en el punto en que está, no solo cuándo se avisó.
    expect(texto()).toContain("En este punto desde");

    // Los datos van con su nombre a la vista, no escondido en un icono: quien
    // consulta su caso no tiene por qué saber qué es cada número.
    for (const etiqueta of [
      "Notificada",
      "Ubicación",
      "Número de serie",
      "Quién la lleva",
      "Lo que se avisó",
      "Cómo ha avanzado",
    ]) {
      expect(texto(), etiqueta).toContain(etiqueta);
    }

    // Y se dice qué es esto y qué no: un resumen consultable, no el expediente
    // del taller. Sin esa frase, la ficha parece incompleta por olvido.
    expect(texto()).toContain("se quedan en el taller");
  });

  test("un caso cerrado dice cuánto tardó, y no presume de seguimiento abierto", async () => {
    estado.respuesta = {
      ...seguimiento,
      status: "resolved" as const,
      closedAt: Date.parse("2026-10-04T09:00:00.000Z"),
      history: [
        ...seguimiento.history,
        {
          status: "resolved" as const,
          at: Date.parse("2026-10-04T09:00:00.000Z"),
        },
      ],
    };
    await consultar(CODIGO);

    expect(texto()).toContain("El caso está cerrado");
    expect(texto()).toContain("Se cerró 3 días después de notificarla");
    expect(texto()).not.toContain("Lleva abierta");
    // La fecha de cierre también va con su nombre, junto a la de notificación.
    expect(texto()).toContain("Cerrada");
  });

  test("llegar con el código en la dirección consulta sin teclear nada", async () => {
    estado.respuesta = seguimiento;
    // Se monta de nuevo con el código que traería la dirección, como al pulsar el
    // enlace del correo.
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await montar(CODIGO);

    // El enlace del correo trae el código puesto: se consulta solo al abrir, y el
    // campo lo enseña para que se vea cuál se está siguiendo.
    expect(estado.consultas).toEqual([`{"code":"${CODIGO}"}`]);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe(
      CODIGO,
    );
    expect(texto()).toContain("A7K2-QX9M");
  });

  test("algo que no es un código no se pregunta: se dice lo que falta", async () => {
    for (const typed of ["la de la cámara", "A7K2"]) {
      estado.consultas.length = 0;
      await consultar(typed);

      expect(estado.consultas, `«${typed}»`).toEqual([]);
      expect(texto()).toContain("Escribe el código de la incidencia");
    }
  });

  test("una letra que se confunde se señala: no es lo mismo que no haberla escrito", async () => {
    // Con una O tecleada de más, «no encontramos nada» manda a buscar donde no es;
    // lo que hay que decir es que esa letra no cabe en un código.
    await consultar("A7K2QX9O");

    expect(estado.consultas).toEqual([]);
    expect(texto()).toContain("Un código no lleva la «O»");
    expect(texto()).not.toContain("No encontramos ninguna incidencia");

    // Y si son varias, se dicen todas: al dictarlo, el cero y la O van juntos.
    await consultar("O0I12KQ3");
    expect(estado.consultas).toEqual([]);
    expect(texto()).toContain("Un código no lleva «O», «0», «I» o «1»");
  });

  test("una referencia interna se reconoce, y se dice de dónde sale el código", async () => {
    // Quien teclea «INC-0004» viene de un aviso viejo: la referencia ya no es la
    // puerta de fuera, así que hay que decirle qué tiene en la mano y cómo se
    // consigue lo que le sirve —el código—, no que le sobran letras.
    for (const typed of ["INC-0004", "inc 4", "incidencia 12", "4"]) {
      estado.consultas.length = 0;
      await consultar(typed);

      expect(estado.consultas, `«${typed}»`).toEqual([]);
      expect(texto()).toContain("Eso parece la referencia del taller");
      expect(texto()).not.toContain("Un código no lleva");
    }
  });

  test("si no hay ninguna con ese código, se dice cuál se buscó", async () => {
    estado.respuesta = null;
    await consultar("zzzzzzzz");

    expect(texto()).toContain("No encontramos ninguna incidencia");
    // Con la forma en que se lee y se dicta, para poder compararla con la del
    // correo de un vistazo.
    expect(texto()).toContain("ZZZZ-ZZZZ");
  });

  test("seguir escribiendo no cambia lo que se está leyendo", async () => {
    estado.respuesta = seguimiento;
    await consultar(CODIGO);
    expect(texto()).toContain("Cámara de estudio · HDC-3500");

    // Lo tecleado después no es una consulta nueva: el resultado sigue siendo el
    // del código que se pidió.
    escribir(`${CODIGO} y algo más`);

    expect(estado.consultas).toEqual([`{"code":"${CODIGO}"}`]);
    expect(texto()).toContain("Cámara de estudio · HDC-3500");
    expect(texto()).not.toContain("No encontramos ninguna incidencia");
  });

  test("agotado el cupo se dice cuánto falta, no que el código no existe", async () => {
    // La puerta admite treinta consultas por hora y código: la que sobra no
    // contesta «no encontramos nada» —eso mandaría a revisar el código—, sino
    // cuánto queda para volver a preguntar.
    estado.freno =
      "Has consultado este código demasiadas veces seguidas (30 consultas por hora). Vuelve a intentarlo en 20 minutos.";
    await consultar(CODIGO);

    expect(texto()).toContain("30 consultas por hora");
    expect(texto()).toContain("20 minutos");
    expect(texto()).not.toContain("No encontramos ninguna incidencia");
  });
});
