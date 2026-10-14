import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import {
  INCIDENT_STATUSES,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
  REQUEST_STATUSES,
} from "../src/convex/schema";

/**
 * Las dos fronteras del taller, vigiladas.
 *
 * 1. `src/lib` son los **módulos puros**: las máquinas de estados, los textos y
 *    las cuentas. Se prueban sin base de datos y sin servidor, y eso se sostiene
 *    mientras no arrastren Convex: el día que uno importe el cliente «para una
 *    cosita», deja de poder probarse solo y deja de poder moverse de sitio.
 *
 * 2. `src/convex` son los **callbacks**: leen la ficha, comprueban permisos y
 *    escriben lo que la máquina dijo. Qué estados admite un paso, a dónde lleva
 *    o si una petición se puede editar se decide en `src/lib`. Un callback que
 *    lo redecide por su cuenta —un estado escrito a pelo, una lista de estados
 *    propia— se separa del resto sin que nada avise: la pantalla ofrece un botón
 *    que el servidor rechaza, o el cierre deja una ficha que el historial no
 *    entiende.
 *
 * Esto no juzga si una regla «es de negocio» —eso no se lee del código—: va a
 * por las dos formas que toma la duplicación (el estado suelto y la lista
 * propia) y comprueba que cada módulo que mueve una máquina sigue
 * preguntándole a la máquina. Quién comprueba las reglas de verdad siguen
 * siendo las pruebas de cada flujo.
 *
 * Se lee el código con el compilador de TypeScript, no con expresiones
 * regulares: así los comentarios —que sí pueden nombrar un estado— no cuentan.
 */

/** La raíz, para leer el código tal cual está en el repositorio. */
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const DIR_LIB = join(RAIZ, "src", "lib");
const DIR_BACKEND = join(RAIZ, "src", "convex");

/** Un archivo fuente, con su ruta relativa para que un fallo se lea bien. */
interface Fuente {
  ruta: string;
  tree: ts.SourceFile;
}

/** Los `.ts` de un directorio y sus subdirectorios (lo generado no cuenta). */
function archivos(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      if (entrada !== "_generated") encontrados.push(...archivos(completo));
    } else if (entrada.endsWith(".ts") && !entrada.endsWith(".d.ts")) {
      encontrados.push(completo);
    }
  }
  return encontrados.sort();
}

/** Los archivos de un directorio, ya analizados. */
function fuentes(dir: string): Fuente[] {
  return archivos(dir).map((completo) => ({
    ruta: relative(RAIZ, completo).split(sep).join("/"),
    tree: ts.createSourceFile(
      completo,
      readFileSync(completo, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  }));
}

/** La línea (empezando en 1) donde está un nodo. */
const linea = (fuente: Fuente, node: ts.Node) =>
  fuente.tree.getLineAndCharacterOfPosition(node.getStart(fuente.tree)).line +
  1;

/* ------------------------------------------------------------------ */
/* Lo que un archivo enlaza                                            */
/* ------------------------------------------------------------------ */

/** Un módulo que un archivo enlaza, y si lo enlaza solo para hablar de tipos. */
interface Enlace {
  modulo: string;
  linea: number;
  soloTipos: boolean;
}

/**
 * Las importaciones y reexportaciones de un archivo. `import type ...` —y un
 * import cuyos nombres llevan todos `type` delante— no deja nada en el archivo
 * compilado: describe la forma de un dato, no arrastra el módulo.
 */
function enlaces(fuente: Fuente): Enlace[] {
  const encontrados: Enlace[] = [];
  const visitar = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const nombres =
        clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements
          : [];
      encontrados.push({
        modulo: node.moduleSpecifier.text,
        linea: linea(fuente, node),
        soloTipos:
          (clause?.isTypeOnly ?? false) ||
          (nombres.length > 0 && nombres.every((nombre) => nombre.isTypeOnly)),
      });
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      encontrados.push({
        modulo: node.moduleSpecifier.text,
        linea: linea(fuente, node),
        soloTipos: node.isTypeOnly,
      });
    }
    ts.forEachChild(node, visitar);
  };
  visitar(fuente.tree);
  return encontrados;
}

/** ¿El módulo enlazado es Convex? El cliente, el servidor, sus helpers o el backend de aquí. */
const esConvex = (modulo: string): boolean =>
  modulo.startsWith("@convex-dev/") || /(^|\/)convex(\/|$)/.test(modulo);

/**
 * La única puerta abierta, y por qué: `getErrorMessage`, en `workshop.ts`, lee el
 * `ConvexError` que lanza el backend. Es el error que cruza la frontera —el
 * idioma con el que la aplicación se cuenta los fallos—, no una llamada a
 * Convex. Cualquier otra cosa que un módulo puro quiera de Convex es un módulo
 * que ha dejado de ser puro.
 */
const CONVEX_TOLERADO: ReadonlyMap<string, readonly string[]> = new Map([
  ["src/lib/workshop.ts", ["convex/values"]],
]);

/* ------------------------------------------------------------------ */
/* Los estados escritos a pelo                                         */
/* ------------------------------------------------------------------ */

/** El vocabulario de las máquinas: los estados, tal y como se llaman. */
const ESTADOS: ReadonlySet<string> = new Set([
  ...Object.values(REQUEST_STATUSES),
  ...Object.values(INCIDENT_STATUSES),
  ...Object.values(PURCHASE_REQUEST_STATUSES),
  ...Object.values(PURCHASE_ORDER_STATUSES),
]);

/**
 * Los estados escritos a pelo en el código **que se ejecuta**. Un estado en una
 * anotación de tipo no cuenta: describe la forma del dato —y así lo hace la
 * ficha de historial, que dice qué dos salidas tiene un cierre—, pero no decide
 * nada. Los nombres de las razones, los tipos de adjunto y lo demás que no es un
 * estado tampoco se tocan.
 */
function estadosSueltos(fuente: Fuente): { estado: string; linea: number }[] {
  const encontrados: { estado: string; linea: number }[] = [];
  const visitar = (node: ts.Node) => {
    if (ts.isTypeNode(node)) return;
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ESTADOS.has(node.text)
    ) {
      encontrados.push({ estado: node.text, linea: linea(fuente, node) });
    }
    ts.forEachChild(node, visitar);
  };
  visitar(fuente.tree);
  return encontrados;
}

/* ------------------------------------------------------------------ */
/* Las máquinas, consultadas                                           */
/* ------------------------------------------------------------------ */

/** Los nombres que un archivo **llama**: `regla(...)` o `modulo.regla(...)`. */
function llamadas(fuente: Fuente): Set<string> {
  const nombres = new Set<string>();
  const visitar = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) nombres.add(callee.text);
      else if (ts.isPropertyAccessExpression(callee))
        nombres.add(callee.name.text);
    }
    ts.forEachChild(node, visitar);
  };
  visitar(fuente.tree);
  return nombres;
}

/**
 * Qué reglas tiene que consultar cada módulo que mueve una máquina. No prueba
 * que no quede ninguna regla fuera —eso es cosa de las pruebas de cada flujo—:
 * prueba que el módulo sigue preguntándole a la máquina, que es lo primero que
 * se pierde cuando alguien empieza a decidir por su cuenta.
 */
const MAQUINAS: ReadonlyArray<{ ruta: string; reglas: readonly string[] }> = [
  {
    // Incidencias: si el paso se puede dar y a dónde lleva.
    ruta: "src/convex/incidents.ts",
    reglas: ["canAdvanceIncident", "incidentStepStatus"],
  },
  {
    // Peticiones: el paso y el destino en uno (`nextRequestStatus`), y si la
    // ficha admite una edición.
    ruta: "src/convex/partRequests.ts",
    reglas: ["nextRequestStatus", "canEditRequest", "isRequestInMotion"],
  },
  {
    // Compras: las dos máquinas que lleva dentro —la orden y sus peticiones—.
    ruta: "src/convex/purchasing.ts",
    reglas: [
      "canAdvancePurchaseOrder",
      "nextPurchaseRequestStatus",
      "purchaseOrderStatusAfterReceiving",
      "purchaseRequestReceivedStatus",
    ],
  },
];

/** Un fuente de mentira, para comprobar que los detectores detectan. */
const muestra = (texto: string): Fuente => ({
  ruta: "muestra.ts",
  tree: ts.createSourceFile("muestra.ts", texto, ts.ScriptTarget.Latest, true),
});

const LIB = fuentes(DIR_LIB);

/** El backend escrito a mano: `schema.ts` declara los estados y `seed.ts` inventa filas. */
const NO_SON_CALLBACKS = new Set(["schema.ts", "seed.ts"]);

const BACKEND = fuentes(DIR_BACKEND).filter(
  (fuente) => !NO_SON_CALLBACKS.has(fuente.ruta.split("/").pop() ?? ""),
);

describe("los módulos puros de `src/lib`", () => {
  test("el detector ve un enlace con Convex (y distingue los de solo tipos)", () => {
    const enlazados = enlaces(
      muestra(
        [
          'import { ConvexError } from "convex/values";',
          'import type { Doc } from "../convex/_generated/dataModel";',
          'import { type Id } from "../convex/_generated/dataModel";',
          'import { plain } from "./richDoc";',
        ].join("\n"),
      ),
    );

    expect(
      enlazados.map((enlace) => [enlace.modulo, enlace.soloTipos]),
    ).toEqual([
      ["convex/values", false],
      ["../convex/_generated/dataModel", true],
      ["../convex/_generated/dataModel", true],
      ["./richDoc", false],
    ]);
    expect(esConvex("convex/react")).toBe(true);
    expect(esConvex("@convex-dev/auth/server")).toBe(true);
    expect(esConvex("../convex/incidents")).toBe(true);
    expect(esConvex("./richDoc")).toBe(false);
  });

  test("se están leyendo de verdad los módulos puros", () => {
    // Sin esto, un fallo al recorrer el árbol dejaría el guardián de abajo
    // pasando en vacío, que es el modo de fallo que no se ve.
    expect(LIB.length).toBeGreaterThan(25);
  });

  test("ninguno arrastra Convex: ni el cliente, ni el servidor, ni un módulo del backend", () => {
    const cierres: string[] = [];
    for (const fuente of LIB) {
      const tolerados = CONVEX_TOLERADO.get(fuente.ruta) ?? [];
      for (const enlace of enlaces(fuente)) {
        if (enlace.soloTipos || !esConvex(enlace.modulo)) continue;
        if (tolerados.includes(enlace.modulo)) continue;
        cierres.push(
          `${fuente.ruta}:${enlace.linea}  importa «${enlace.modulo}»`,
        );
      }
    }

    const informe = cierres.join("\n");
    expect(
      informe,
      "Un módulo de `src/lib` ha enlazado Convex. Estos módulos se prueban sin\n" +
        "base de datos y sin servidor, y las reglas del taller tienen que poder\n" +
        "leerse y probarse solas. Si lo que hacía falta era la forma de una fila,\n" +
        "vale un `import type`; si era el error del backend, `convex/values`\n" +
        "—como en `workshop.ts`—; si era una regla, la regla se escribe aquí:\n\n" +
        informe,
    ).toBe("");
  });

  test("la puerta abierta es exactamente la que hace falta", () => {
    // Una lista de excepciones que no se limpia acaba tapando justo lo que se
    // quería vigilar: si `workshop.ts` dejara de leer el `ConvexError`, la
    // excepción sobra y este test lo dice.
    const abiertas = LIB.flatMap((fuente) =>
      enlaces(fuente)
        .filter((enlace) => !enlace.soloTipos && esConvex(enlace.modulo))
        .map((enlace) => `${fuente.ruta} → ${enlace.modulo}`),
    );

    const esperadas = [...CONVEX_TOLERADO].flatMap(([ruta, modulos]) =>
      modulos.map((modulo) => `${ruta} → ${modulo}`),
    );

    expect(
      abiertas.sort(),
      "Solo el lector de errores de `workshop.ts` puede enlazar Convex: su\n" +
        "`ConvexError` es el único error que cruza la frontera.",
    ).toEqual(esperadas.sort());
  });
});

describe("los callbacks del backend", () => {
  test("el detector ve un estado a pelo, y no se mete con los tipos", () => {
    // Control positivo: un estado suelto en una comparación, en un `patch` y en
    // un validador de argumentos.
    expect(
      estadosSueltos(
        muestra(
          [
            'if (peticion.status === "pending") {}',
            'ctx.db.patch(id, { status: "cancelled" });',
            'const args = { status: v.optional(v.union(v.literal("partial"))) };',
          ].join("\n"),
        ),
      ).map((suelto) => `${suelto.linea}:${suelto.estado}`),
    ).toEqual(["1:pending", "2:cancelled", "3:partial"]);

    // Un estado en un tipo describe la forma del dato; una razón no es un
    // estado; y un estado entre acentos graves, tampoco se escapa.
    expect(
      estadosSueltos(
        muestra('type Cierre = { status: "resolved" | "unresolved" };'),
      ),
    ).toEqual([]);
    expect(
      estadosSueltos(muestra('const razon = "requestCancelled";')),
    ).toEqual([]);
    expect(
      estadosSueltos(muestra("if (row.status === `ordered`) {}")).map(
        (suelto) => suelto.estado,
      ),
    ).toEqual(["ordered"]);
  });

  test("se están leyendo de verdad los callbacks", () => {
    expect(BACKEND.length).toBeGreaterThan(10);
    expect(BACKEND.some((fuente) => fuente.ruta.endsWith("incidents.ts"))).toBe(
      true,
    );
    // El esquema y la muestra quedan fuera a propósito: declaran los estados e
    // inventan filas de todos los colores.
    expect(BACKEND.some((fuente) => fuente.ruta.endsWith("schema.ts"))).toBe(
      false,
    );
    expect(BACKEND.some((fuente) => fuente.ruta.endsWith("seed.ts"))).toBe(
      false,
    );
  });

  test("ninguno escribe un estado a pelo: los estados son los de su tabla", () => {
    const sueltos = BACKEND.flatMap((fuente) =>
      estadosSueltos(fuente).map(
        ({ estado, linea }) =>
          `${fuente.ruta}:${linea}  escribe «${estado}» a pelo`,
      ),
    );

    const informe = sueltos.join("\n");
    expect(
      informe,
      "Un estado suelto en un callback es una segunda tabla de estados, que se\n" +
        "separa de la primera sin que nadie lo note. Usa la constante de\n" +
        "`src/convex/schema.ts` (o el validador de la tabla, si es un argumento),\n" +
        "y deja la decisión —qué estados admite el paso, a dónde lleva— donde\n" +
        "está escrita la máquina (`src/lib/`):\n\n" +
        informe,
    ).toBe("");
  });

  test("el detector de llamadas ve la consulta, y no una importación", () => {
    const fuente = muestra(
      [
        'import { canAdvanceIncident, incidentStepStatus } from "../lib/incidentFlow";',
        'if (!canAdvanceIncident(incidencia.status, "assign")) {',
        '  const destino = incidentStepStatus("assign");',
        "}",
      ].join("\n"),
    );

    expect([...llamadas(fuente)].sort()).toEqual([
      "canAdvanceIncident",
      "incidentStepStatus",
    ]);
  });

  test("cada módulo que mueve una máquina sigue preguntándole a la máquina", () => {
    const olvidos: string[] = [];
    for (const { ruta, reglas } of MAQUINAS) {
      const fuente = BACKEND.find((archivo) => archivo.ruta === ruta);
      expect(fuente, `no se encuentra ${ruta}`).toBeDefined();
      if (!fuente) continue;
      const usadas = llamadas(fuente);
      for (const regla of reglas) {
        if (!usadas.has(regla))
          olvidos.push(`${ruta}  ya no consulta ${regla}()`);
      }
    }

    const informe = olvidos.join("\n");
    expect(
      informe,
      "Este módulo mueve una máquina y ha dejado de consultarla: si el paso y su\n" +
        "destino ya no salen de `src/lib`, los está decidiendo él. Si de verdad la\n" +
        "regla ha cambiado, cambia la máquina —y su tabla en `MAQUINAS.md`—, no\n" +
        "este callback:\n\n" +
        informe,
    ).toBe("");
  });
});
