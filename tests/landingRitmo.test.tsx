// @vitest-environment jsdom
import { act, type ReactNode } from "react";
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
import { MemoryRouter } from "react-router";

/**
 * El ritmo vertical de la portada, en el ancho que más se mira: el móvil.
 *
 * Dos cosas se fijan aquí, y las dos son de maquetación, no de contenido:
 *
 * 1. **La consola de supervisión no se pinta por debajo de `lg`.** Es una maqueta
 *    del panel, no el panel; en un móvil no cabe junto al titular y estorba. En su
 *    lugar queda la línea de resumen con lo que de verdad se mira de un vistazo.
 *    Como la portada no usa JavaScript para decidirlo —sería un salto al cargar,
 *    y el HTML se pinta igual sin él— la decisión está en las clases: la consola
 *    nace `hidden` y solo aparece en `lg`, y el resumen nace visible y se esconde
 *    en `lg`. Eso es lo que se comprueba, resolviendo la cascada de breakpoints
 *    como la resolvería el navegador.
 *
 * 2. **El hueco entre el hero y el aviso se mantiene.** Lo que separa dos bloques
 *    es el relleno de abajo de uno más el de arriba del siguiente: 3rem + 3rem en
 *    móvil, 96 px, el mismo aire que separa el resto de secciones. Si alguien
 *    toca uno de los dos lados —o se le olvida el `sm:` que lo acompaña— el test
 *    lo dice, con los tres anchos medidos de una vez.
 * Ninguna de las dos se apoya en JavaScript a propósito: la portada se decide en
 * CSS, así que se pinta igual sin hidratar y no da un salto al cargar.
 *
 * jsdom no calcula estilos ni aplica media queries, así que aquí no se mide
 * ningún píxel pintado: se leen las clases y se resuelve la misma cascada que
 * aplicaría Tailwind. Es una prueba del contrato de la maqueta —quién se pinta en
 * cada ancho y cuánto aire hay entre bloques—, no una prueba de renderizado; el
 * aval de cómo queda en pantalla sigue siendo la medición en el navegador.
 */

const { MOCK_AUTH, MOCK_CIFRAS } = vi.hoisted(() => ({
  MOCK_AUTH: { isLoading: false, isAuthenticated: false },
  // La foto pública del taller, fija: la portada la pinta tal cual, así que lo
  // que se comprueba es que enseña esos números y no otros.
  // Va en un sobre para poder cambiar la respuesta entre pruebas: la portada
  // tiene que saber enseñar una foto y también su ausencia.
  MOCK_CIFRAS: { actual: null as Foto | null },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: MOCK_AUTH.isAuthenticated,
    isLoading: MOCK_AUTH.isLoading,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// La única consulta que la portada pide al montar son las cifras del taller; el
// seguimiento por código espera a que alguien lo envíe, y aquí no se envía.
vi.mock("convex/react", () => ({
  useQuery: () => MOCK_CIFRAS.actual,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

import Landing from "@/pages/Landing";

/** Lo que devuelve la foto pública del taller. */
type Foto = {
  equipment: number;
  spareParts: number;
  openIncidents: number;
  closedLastMonth: number;
  meanResolutionMinutes: number | null;
  computedAt: number;
};

/**
 * La foto de la prueba. Los números no se parecen entre sí a propósito: así una
 * casilla que enseñe el valor de otra se nota.
 */
function foto(cambios: Partial<Foto> = {}): Foto {
  return {
    equipment: 24,
    spareParts: 43,
    openIncidents: 69,
    closedLastMonth: 14,
    meanResolutionMinutes: 260,
    computedAt: Date.now() - 5 * 60 * 1000,
    ...cambios,
  };
}

/** Los anchos que la portada distingue, en el orden en que los aplica el navegador. */
const CASCADA = ["base", "sm", "lg"] as const;
type Ancho = (typeof CASCADA)[number];

/** La escala de espaciado de Tailwind, en rem, hasta donde llega la portada. */
const ESCALA: Record<string, number> = {
  "0.5": 0.125,
  "1": 0.25,
  "1.5": 0.375,
  "2": 0.5,
  "2.5": 0.625,
  "3": 0.75,
  "3.5": 0.875,
  "4": 1,
  "5": 1.25,
  "6": 1.5,
  "7": 1.75,
  "8": 2,
  "9": 2.25,
  "10": 2.5,
  "11": 2.75,
  "12": 3,
  "14": 3.5,
  "16": 4,
  "20": 5,
  "24": 6,
  "28": 7,
  "32": 8,
  "40": 10,
  "48": 12,
  "56": 14,
  "64": 16,
  "72": 18,
  "80": 20,
  "96": 24,
};

const RELLENO = /^(?:(sm|md|lg|xl|2xl):)?(p|pt|pb|py)-(.+)$/;
const PANTALLA =
  /^(?:(sm|md|lg|xl|2xl):)?(hidden|block|flex|grid|inline|inline-block|inline-flex)$/;

/** Dentro de un mismo ancho, cómo de concreto es el atajo del relleno. */
const CONCRECION: Record<string, number> = { p: 0, py: 1, pt: 2, pb: 2 };

/** Las clases de un elemento, ya separadas. */
function clases(elemento: Element): string[] {
  return (elemento.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

/**
 * Cuánto relleno tiene un lado del elemento en un ancho dado, en píxeles.
 *
 * Se recorre la cascada entera hasta el ancho pedido —base, luego `sm`, luego
 * `lg`— como el navegador, que aplica las media queries de menor a mayor y no
 * deshace lo que la anterior ya puso: lo que `lg` no toca se queda como estaba
 * en `sm`. Dentro de un mismo ancho manda lo más concreto, que es como lo emite
 * Tailwind —`pb-2` por delante de `py-4`—, y así una clase no depende del orden en
 * que esté escrita en el atributo.
 *
 * Un relleno de un paso que no está en la escala revienta en vez de devolver un
 * número inventado: si la portada usa un valor nuevo, esta prueba tiene que
 * enterarse.
 */
function relleno(
  elemento: Element,
  lado: "top" | "bottom",
  ancho: Ancho,
): number {
  const hasta = CASCADA.indexOf(ancho);
  const propio = `p${lado === "top" ? "t" : "b"}`;
  let valor = 0;
  for (const escala of CASCADA.slice(0, hasta + 1)) {
    let concrecion = -1;
    for (const clase of clases(elemento)) {
      const encontrado = RELLENO.exec(clase);
      if (!encontrado) continue;
      const [, variante = "base", utilidad, paso] = encontrado;
      if (variante !== escala) continue;
      if (utilidad !== "p" && utilidad !== propio && utilidad !== "py")
        continue;
      if (CONCRECION[utilidad] < concrecion) continue;
      const rem = ESCALA[paso];
      if (rem === undefined)
        throw new Error(
          `«${clase}» usa un paso de espaciado que la prueba no conoce.`,
        );
      valor = rem;
      concrecion = CONCRECION[utilidad];
    }
  }
  return valor * 16;
}

/**
 * Si el elemento se pinta en un ancho dado.
 *
 * Mismo razonamiento que con el relleno: se resuelve la cascada de utilidades de
 * `display` y gana la última. Un elemento sin ninguna es visible, que es lo que
 * hace el navegador con un `div` sin clases.
 */
function sePinta(elemento: Element, ancho: Ancho): boolean {
  const hasta = CASCADA.indexOf(ancho);
  let pantalla = "block";
  for (const escala of CASCADA.slice(0, hasta + 1)) {
    for (const clase of clases(elemento)) {
      const encontrado = PANTALLA.exec(clase);
      if (!encontrado) continue;
      const [, variante = "base", utilidad] = encontrado;
      if (variante !== escala) continue;
      pantalla = utilidad;
    }
  }
  return pantalla !== "hidden";
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // framer-motion consulta el movimiento reducido; jsdom no trae `matchMedia`.
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
});

beforeEach(async () => {
  MOCK_CIFRAS.actual = foto();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const pagina: ReactNode = (
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
  await act(async () => {
    root.render(pagina);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/** Vuelve a pintar la portada con lo que haya ahora en el sobre de la foto. */
async function remontar() {
  act(() => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
  });
}

/**
 * El valor de una casilla de la banda de cifras, leído por su rótulo: así no
 * importa en qué orden se pinten los números.
 */
function cifra(label: string): string {
  const rotulo = [...document.querySelectorAll("#taller dt")].find(
    (nodo) => nodo.textContent?.trim() === label,
  );
  if (!rotulo) throw new Error(`La banda de cifras ya no tiene «${label}».`);
  return rotulo.parentElement?.querySelector("dd")?.textContent?.trim() ?? "";
}

/** Un elemento de la portada, o un fallo claro si la maqueta dejó de tenerlo. */
function buscar(selector: string, que: string): HTMLElement {
  const encontrado = container.querySelector<HTMLElement>(selector);
  if (!encontrado) throw new Error(`La portada ya no tiene ${que}.`);
  return encontrado;
}

/**
 * El hueco que se espera entre cada par de bloques, en píxeles.
 *
 * Los bloques de contenido se separan con el aire de una sección a cada lado;
 * página: hero, cifras, la tarjeta de las dos puertas y pie.
 */
const ESCALERA: Record<Ancho, number[]> = {
  base: [96, 96, 96],
  sm: [112, 112, 112],
  lg: [160, 160, 160],
};

/**
 * Los bloques de la portada, en el orden en que se pintan, y comprobando que de
 * verdad son hermanos seguidos: si alguien mete un bloque en medio, el hueco que
 * mide la escalera deja de ser el de los dos vecinos que dice medir.
 */
function escalera(): { nombre: string; elemento: HTMLElement }[] {
  const pie = buscar("footer", "el pie");

  const bloques = [
    { nombre: "hero", elemento: buscar("h1", "el titular").closest("section") },
    { nombre: "cifras", elemento: buscar("#taller", "la banda de cifras") },
    {
      nombre: "puertas",
      elemento: buscar("#avisar", "el centro de aviso").closest("section"),
    },
    { nombre: "pie", elemento: pie },
  ];

  for (const bloque of bloques) {
    if (!bloque.elemento)
      throw new Error(`La portada ya no tiene el bloque «${bloque.nombre}».`);
  }

  for (let indice = 0; indice < bloques.length - 1; indice += 1) {
    const siguiente = bloques[indice + 1];
    expect(
      bloques[indice].elemento.nextElementSibling,
      `${bloques[indice].nombre} y ${siguiente.nombre} deberían ser hermanos seguidos`,
    ).toBe(siguiente.elemento);
  }

  return bloques as { nombre: string; elemento: HTMLElement }[];
}

describe("la portada en móvil", () => {
  test("la consola de supervisión no se pinta por debajo de lg", () => {
    const consola = buscar(
      '[data-testid="consola-tecnica"]',
      "la consola técnica",
    );

    // Existe en el HTML —no se monta y desmonta al cambiar de ancho—, pero no se
    // pinta: en móvil y en tableta queda fuera, y solo aparece cuando la portada
    // ya tiene dos columnas.
    expect(sePinta(consola, "base")).toBe(false);
    expect(sePinta(consola, "sm")).toBe(false);
    expect(sePinta(consola, "lg")).toBe(true);
  });

  test("en su lugar queda la línea de resumen, visible solo hasta lg", () => {
    const resumen = buscar(
      '[data-testid="resumen-movil"]',
      "el resumen del móvil",
    );

    expect(sePinta(resumen, "base")).toBe(true);
    expect(sePinta(resumen, "sm")).toBe(true);
    // Con la consola delante, la línea sobra: es el mismo dato dos veces.
    expect(sePinta(resumen, "lg")).toBe(false);
    // Y lleva las cifras del taller, no una muestra: al lado de la banda de
    // abajo, un número inventado aquí se leería como el del taller.
    expect(resumen.textContent).toContain("69 incidencias abiertas");
    expect(resumen.textContent).toContain("24 equipos en servicio");
  });

  test("la banda de cifras enseña la foto del taller, no una muestra", () => {
    // La foto es la que manda el backend: cada casilla dice lo suyo y la media
    // va en horas y minutos, no en minutos crudos.
    expect(cifra("Equipos en servicio")).toBe("24");
    expect(cifra("Repuestos en catálogo")).toBe("43");
    expect(cifra("Incidencias abiertas")).toBe("69");
    expect(cifra("Tiempo medio de resolución")).toBe("4 h 20");

    const banda = buscar("#taller", "la banda de cifras");
    // Y dice cuándo se contó, que es lo que separa una cifra de una promesa.
    expect(banda.textContent).toContain("Actualizado");
    expect(banda.textContent).toContain("14 incidencias cerradas en 30 días");
    expect(banda.textContent).not.toContain("ejemplo");
  });

  test("entre el hero y el aviso se mantiene el hueco, ya con las cifras en medio", () => {
    const hero = buscar("h1", "el titular").closest("section");
    if (!hero) throw new Error("El titular ya no está dentro de una sección.");
    const cifras = buscar("#taller", "la banda de cifras");

    // El aire entre dos bloques es el relleno de abajo de uno más el de arriba del
    // siguiente. En móvil, 3rem + 3rem: los mismos 96 px que separan los demás
    // bloques de contenido.
    const hueco = (ancho: Ancho) =>
      relleno(hero, "bottom", ancho) + relleno(cifras, "top", ancho);

    expect(hueco("base")).toBe(96);
    expect(hueco("sm")).toBe(112);
    expect(hueco("lg")).toBe(160);
  });

  test("hasta tableta, el hero y las cifras ponen el mismo aire", () => {
    const hero = buscar("h1", "el titular").closest("section");
    if (!hero) throw new Error("El titular ya no está dentro de una sección.");
    const cifras = buscar("#taller", "la banda de cifras");

    // 3rem y 3.5rem a cada lado: el hueco no lo pone un solo bloque.
    for (const ancho of ["base", "sm"] as const) {
      expect(relleno(hero, "bottom", ancho), `hero/cifras en ${ancho}`).toBe(
        relleno(cifras, "top", ancho),
      );
    }
  });

  test("la escalera entera: 96 entre bloques", () => {
    const bloques = escalera();

    // La página se lee como una sola pieza porque los bloques se separan todos
    // igual. Las dos puertas del taller cuentan como un bloque —son una sola
    // tarjeta—, así que la escalera tiene un tramo menos que bloques hay.
    for (const [indice, esperado] of ESCALERA.base.entries()) {
      const desde = bloques[indice];
      const hasta = bloques[indice + 1];
      expect(
        relleno(desde.elemento, "bottom", "base") +
          relleno(hasta.elemento, "top", "base"),
        `${desde.nombre} → ${hasta.nombre} en móvil`,
      ).toBe(esperado);
    }
  });

  test("el aviso y el seguimiento comparten caja", () => {
    const aviso = buscar("#avisar", "el centro de aviso");
    const seguimiento = buscar("#seguimiento", "el seguimiento");

    // Dos puertas, una sola caja: el seguimiento cuelga de la misma tarjeta que
    // el aviso —no de una suya— y de la misma sección.
    const tarjeta = aviso.parentElement;
    expect(tarjeta).not.toBeNull();
    expect(tarjeta?.contains(seguimiento)).toBe(true);
    expect(seguimiento.closest(".rounded-2xl")).toBe(tarjeta);
    expect(aviso.closest("section")).toBe(seguimiento.closest("section"));

    // Y las dos mitades llegan enteras: cada una con su icono y su titular.
    for (const mitad of [aviso, seguimiento]) {
      expect(mitad.querySelector("svg"), "una mitad sin icono").not.toBeNull();
      expect(
        mitad.querySelector("h2")?.textContent?.trim(),
        "una mitad sin titular",
      ).toBeTruthy();
    }
  });

  test("la escalera sube con el ancho: 112 en tableta y 160 en escritorio", () => {
    const bloques = escalera();

    for (const ancho of ["sm", "lg"] as const) {
      for (const [indice, esperado] of ESCALERA[ancho].entries()) {
        const desde = bloques[indice];
        const hasta = bloques[indice + 1];
        expect(
          relleno(desde.elemento, "bottom", ancho) +
            relleno(hasta.elemento, "top", ancho),
          `${desde.nombre} → ${hasta.nombre} en ${ancho}`,
        ).toBe(esperado);
      }
    }
  });
});

describe("cuando el taller aún no tiene cifras", () => {
  test("enseña guiones y lo dice, en vez de ceros", async () => {
    MOCK_CIFRAS.actual = null;
    await remontar();

    // Sin foto no hay nada que enseñar: un cero sería una afirmación falsa.
    for (const rotulo of [
      "Equipos en servicio",
      "Repuestos en catálogo",
      "Incidencias abiertas",
      "Tiempo medio de resolución",
    ]) {
      expect(cifra(rotulo), rotulo).toBe("—");
    }
    expect(container.textContent).toContain(
      "Consultando las cifras del taller",
    );
    expect(container.textContent).toContain("Consultando el taller");
  });

  test("sin muestra bastante, la media va a guion y dice por qué", async () => {
    MOCK_CIFRAS.actual = foto({ meanResolutionMinutes: null });
    await remontar();

    expect(cifra("Tiempo medio de resolución")).toBe("—");
    // Los recuentos siguen saliendo: lo que falta es la media, no la foto.
    expect(cifra("Incidencias abiertas")).toBe("69");
    expect(container.textContent).toContain(
      "se publica a partir de 5 incidencias cerradas",
    );
  });
});

describe("el resolvedor de la prueba", () => {
  test("aplica la cascada de anchos y la utilidad de cada lado", () => {
    const caja = document.createElement("div");
    caja.className = "py-4 sm:pt-6 lg:pb-10 pb-2";
    document.body.append(caja);

    expect(relleno(caja, "top", "base")).toBe(16);
    // El lado concreto gana al atajo aunque esté escrito antes.
    expect(relleno(caja, "bottom", "base")).toBe(8);
    expect(relleno(caja, "top", "sm")).toBe(24);
    expect(relleno(caja, "bottom", "sm")).toBe(8);
    expect(relleno(caja, "bottom", "lg")).toBe(40);
    // Y lo que `lg` no toca se queda donde lo dejó `sm`.
    expect(relleno(caja, "top", "lg")).toBe(24);

    caja.className = "flex lg:hidden";
    expect(sePinta(caja, "base")).toBe(true);
    expect(sePinta(caja, "sm")).toBe(true);
    expect(sePinta(caja, "lg")).toBe(false);

    caja.remove();
  });
});
