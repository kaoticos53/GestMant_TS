import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Guarda contra la lista larga sin acotar: la que empuja su barra de
 * desplazamiento —y lo que va debajo, como el pie con la paginación y el
 * recuento— hasta el final de la página, de modo que para llegar a su final y
 * para recorrerla hay que bajar por la página entera.
 *
 * La solución del taller es `ListArea`: acota el alto a lo que mide la ventana,
 * desplaza lo que no cabe por dentro y deja lo de abajo a la vista. Todas las
 * vistas del panel que pintan una lista que se recorre la usan... y la
 * auditoría dejó de usarla sin que nada lo notara: la lista seguía funcionando,
 * solo que estirada. Eso es lo que este test impide que vuelva a pasar.
 *
 * Se lee el código con el compilador de TypeScript, como
 * `floating-promises.test.ts`, y sin navegador: se busca la firma del fallo, no
 * su efecto.
 *
 * La regla, y por qué es esta:
 *
 * - **Las vistas del panel**: los componentes exportados cuyo nombre acaba en
 *   `View` —`AuditView`, `RequestsView`…—, que son las pantallas de los
 *   módulos. Lo que se pinta dentro de una ficha, un diálogo o un aviso queda
 *   fuera: esos ya traen su propio recuadro con desplazamiento.
 * - **Lo que cuenta como fila**: `li` y `TableRow`, que son las dos formas con
 *   las que el panel pinta un registro que se repite —las colas y la auditoría
 *   usan `li`; las tablas, `TableRow`—. No entran ni los botones de una fila de
 *   opciones ni los `<div>` de adorno, que no se distinguen de un bloque suelto.
 * - **Lo que ya viene recortado no es una lista larga**: si la lista sale de un
 *   `.slice(0, 4)`, se ve entera siempre.
 *
 * Cuando la regla salta, el fallo dice dónde: archivo, línea, componente y la
 * lista. La solución es envolver las filas en `ListArea` (y sacar de dentro lo
 * que tenga que seguir a la vista), no mover el test.
 */

const DASHBOARD_DIR = fileURLToPath(
  new URL("../src/pages/dashboard", import.meta.url),
);

/** Las etiquetas que pintan una fila de una lista que se recorre. */
const ROW_TAGS = new Set(["li", "TableRow"]);

/** El componente que acota el alto: el área de la lista. */
const AREA = "ListArea";

/** Hasta cuántas filas puede venir ya recortada una lista para no ser larga. */
const SHORT_SLICE = 10;

/** Una lista que se recorre sin que nada le acote el alto. */
interface LongList {
  /** Archivo, tal y como se nombra en el fallo. */
  file: string;
  /** Línea del `.map(` que la pinta. */
  line: number;
  /** El componente que la pinta —una vista del panel—. */
  component: string;
  /** Con qué etiqueta pinta cada fila. */
  tag: string;
  /** Lo que recorre, como se lee en el código. */
  rows: string;
}

interface Parsed {
  file: string;
  tree: ts.SourceFile;
}

function parse(file: string, text: string): Parsed {
  return {
    file,
    tree: ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

/**
 * Cómo se llama el elemento JSX de esa etiqueta («li», «ListArea»…). El que se
 * abre y se cierra lleva la etiqueta en su apertura; el de una sola pieza, en sí
 * mismo.
 */
function tagOf(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  const tag = ts.isJsxSelfClosingElement(node)
    ? node.tagName
    : node.openingElement.tagName;
  return tag.getText();
}

/** El primer elemento JSX que se pinta dentro de esa expresión, si hay alguno. */
function firstJsx(
  node: ts.Node | undefined,
  depth = 0,
): ts.JsxElement | ts.JsxSelfClosingElement | null {
  if (!node || depth > 6) return null;
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) return node;
  let found: ts.JsxElement | ts.JsxSelfClosingElement | null = null;
  node.forEachChild((child) => {
    if (!found) found = firstJsx(child, depth + 1);
  });
  return found;
}

/** ¿Esa fila se pinta dentro de un área que le acota el alto? */
function insideArea(node: ts.Node): boolean {
  let parent: ts.Node | undefined = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent) && tagOf(parent) === AREA) return true;
    parent = parent.parent;
  }
  return false;
}

/**
 * El componente que está pintando eso: el primer nombre que se encuentra al subir
 * —una vista, o el componente de dentro que la pinta—. Las funciones sueltas
 * —el `map` de dentro— no tienen nombre y se siguen subiendo.
 */
function componentOf(node: ts.Node): string | null {
  let parent: ts.Node | undefined = node.parent;
  while (parent) {
    if (
      ts.isFunctionDeclaration(parent) &&
      parent.name &&
      ts.isIdentifier(parent.name)
    ) {
      return parent.name.text;
    }
    if (
      (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) &&
      ts.isVariableDeclaration(parent.parent) &&
      ts.isIdentifier(parent.parent.name)
    ) {
      return parent.parent.name.text;
    }
    parent = parent.parent;
  }
  return null;
}

/** Los componentes que exporta el archivo: la vista del panel, si la hay. */
function exportedNames(tree: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const exported = (node: ts.Node) =>
    !!node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  tree.forEachChild((statement) => {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      exported(statement)
    ) {
      names.add(statement.name.text);
    }
    if (ts.isVariableStatement(statement) && exported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  });
  return names;
}

/**
 * Si la lista viene ya recortada a un puñado de filas —`.slice(0, 4)`—, no es
 * una lista que se recorra: se ve entera de una vez.
 */
function cappedTo(receiver: ts.Expression): number | null {
  if (
    !ts.isCallExpression(receiver) ||
    !ts.isPropertyAccessExpression(receiver.expression) ||
    receiver.expression.name.getText() !== "slice"
  ) {
    return null;
  }
  const last = receiver.arguments[receiver.arguments.length - 1];
  if (!last || !ts.isNumericLiteral(last)) return null;
  return Number(last.text);
}

/** Las listas que una vista pinta sin acotarles el alto, con su sitio exacto. */
export function longLists(file: string, text: string): LongList[] {
  const { tree } = parse(file, text);
  const exported = exportedNames(tree);
  const found: LongList[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText() === "map"
    ) {
      const callback = node.arguments[0];
      const rows = node.expression.expression;
      const tag = callback && firstJsx(callback);
      const component = componentOf(node);
      const capped = cappedTo(rows);

      if (
        callback &&
        ts.isArrowFunction(callback) &&
        tag &&
        ROW_TAGS.has(tagOf(tag)) &&
        component !== null &&
        exported.has(component) &&
        component.endsWith("View") &&
        !(capped !== null && capped <= SHORT_SLICE) &&
        !insideArea(node)
      ) {
        found.push({
          file,
          line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          component,
          tag: tagOf(tag),
          rows: rows.getText(),
        });
      }
    }
    node.forEachChild(visit);
  };
  visit(tree);

  return found;
}

/** Cómo se lee un hallazgo en el fallo. */
function describeFinding(finding: LongList): string {
  return `${finding.file}:${finding.line} — ${finding.component} pinta <${finding.tag}> para ${finding.rows}`;
}

describe("las listas de las vistas del panel", () => {
  test("una vista que pinta filas sin área que las acote se caza", () => {
    const suelto = `
      export function AuditView() {
        return (
          <div>
            {groups.map((group) => (
              <ul>{group.items.map((entry) => <li key={entry.id}>{entry.name}</li>)}</ul>
            ))}
          </div>
        );
      }
    `;
    const [found] = longLists("AuditView.tsx", suelto);

    expect(found?.component).toBe("AuditView");
    expect(found?.tag).toBe("li");
    expect(found?.rows).toBe("group.items");
  });

  test("las mismas filas dentro del área no se cazan", () => {
    const acotado = `
      export function AuditView() {
        return (
          <ListArea resetKey={listKey}>
            <ul>{group.items.map((entry) => <li key={entry.id}>{entry.name}</li>)}</ul>
          </ListArea>
        );
      }
    `;

    expect(longLists("AuditView.tsx", acotado)).toEqual([]);
  });

  test("de una ficha o un diálogo no se dice nada: ya traen su recuadro", () => {
    // El detalle de una incidencia pinta sus adjuntos con su propio
    // desplazamiento dentro del panel lateral; no es una lista de la pantalla.
    const ficha = `
      function IncidentDetailSheet({ incident }) {
        return (
          <ul>{incident.documents.map((doc) => <li key={doc.id}>{doc.name}</li>)}</ul>
        );
      }
      export function IncidentsView() {
        return <IncidentDetailSheet incident={incident} />;
      }
    `;

    expect(longLists("IncidentsView.tsx", ficha)).toEqual([]);
  });

  test("lo que ya viene recortado a un puñado de filas no es una lista larga", () => {
    const recortado = `
      export function ProfileView() {
        return (
          <ul>{myIncidents.slice(0, 5).map((incident) => <li key={incident.id}>{incident.reference}</li>)}</ul>
        );
      }
    `;

    expect(longLists("ProfileView.tsx", recortado)).toEqual([]);
  });

  test("ninguna vista del panel pinta filas sin acotar el alto", () => {
    const found: LongList[] = [];
    for (const file of readdirSync(DASHBOARD_DIR)) {
      if (!file.endsWith(".tsx")) continue;
      const text = readFileSync(join(DASHBOARD_DIR, file), "utf8");
      found.push(...longLists(file, text));
    }

    // El mensaje lleva el sitio exacto: la solución es envolver esas filas en
    // `ListArea` —y sacar de dentro lo que tenga que seguir a la vista—, no
    // tocar este test.
    expect(
      found.map(describeFinding),
      "Estas vistas pintan listas que se recorren sin acotarles el alto:\n",
    ).toEqual([]);
  });
});
