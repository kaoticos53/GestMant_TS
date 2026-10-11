import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Guarda contra el bug que se coló en las incidencias: un helper `async`
 * llamado sin `await`.
 *
 * Si a `requireIncidentEditor` se le olvidaba el `await`, el rechazo se
 * convertía en un *unhandled rejection* y **la mutación continuaba**, así que la
 * comprobación de permisos no se aplicaba y cualquiera podía editar documentos.
 * No es un fallo de tipos —`eslint` no lo ve sin información de tipos, y no
 * había ni un test que lo cubriera— sino de una promesa descartada.
 *
 * Este test recorre el backend con el compilador de TypeScript: primero recoge
 * los helpers declarados `async` en `src/convex` y después busca llamadas a
 * ellos cuyo resultado se tira a la basura.
 *
 * `void helper()` es la salida explícita cuando el descarte es deliberado.
 */

const CONVEX_DIR = fileURLToPath(new URL("../src/convex", import.meta.url));

interface ParsedSource {
  /** Ruta relativa al proyecto, para que el fallo sea legible. */
  path: string;
  text: string;
  tree: ts.SourceFile;
}

function parse(path: string, text: string): ParsedSource {
  return {
    path,
    text,
    tree: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true),
  };
}

/** Todos los `.ts` de funciones de la app (el código generado no cuenta). */
function convexFiles(dir = CONVEX_DIR): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "_generated") files.push(...convexFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files.sort();
}

function readConvexSources(): ParsedSource[] {
  return convexFiles().map((full) =>
    parse(relative(process.cwd(), full), readFileSync(full, "utf8")),
  );
}

const isAsync = (node: ts.Node): boolean =>
  !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);

/** Los nombres declarados `async`: son los que devuelven una promesa. */
function collectAsyncHelpers(sources: ParsedSource[]): Set<string> {
  const names = new Set<string>();
  for (const { tree } of sources) {
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && isAsync(node) && node.name) {
        names.add(node.name.text);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)) &&
        isAsync(node.initializer)
      ) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return names;
}

interface DiscardedCall {
  path: string;
  line: number;
  name: string;
  snippet: string;
}

/**
 * Llamadas a un helper `async` cuyo resultado se descarta: la forma exacta del
 * bug es una sentencia que es solo `helper(ctx);`.
 *
 * `void helper(ctx);` no aparece como `CallExpression` desnuda, así que el
 * descarte deliberado queda permitido sin ninguna lista de excepciones.
 */
function findDiscardedCalls(
  source: ParsedSource,
  asyncHelpers: ReadonlySet<string>,
): DiscardedCall[] {
  const found: DiscardedCall[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression)
    ) {
      const callee = node.expression.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (name !== null && asyncHelpers.has(name)) {
        const { line } = source.tree.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        found.push({
          path: source.path,
          line: line + 1,
          name,
          snippet: node.getText(source.tree).split("\n")[0],
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source.tree);
  return found;
}

describe("llamadas sin await en el backend de Convex", () => {
  test("el detector reconoce una promesa descartada (y respeta el descarte explícito)", () => {
    // Control positivo: si el detector dejara de detectar, este test lo delata
    // y el guardián de abajo no pasaría por estar vacío.
    const sample = parse(
      "muestra.ts",
      [
        "async function requireEditor(ctx: unknown) { return ctx; }",
        "async function ok(ctx: unknown) {",
        "  await requireEditor(ctx);", // esperado: nada que reprochar
        "  void requireEditor(ctx);", // descarte deliberado: permitido
        "  const pending = requireEditor(ctx);", // no es una sentencia suelta
        "}",
        "function mala(ctx: unknown) {",
        "  requireEditor(ctx);", // ← el bug
        "}",
      ].join("\n"),
    );

    const discarded = findDiscardedCalls(sample, collectAsyncHelpers([sample]));
    expect(discarded).toHaveLength(1);
    expect(discarded[0].name).toBe("requireEditor");
    expect(discarded[0].line).toBe(8);
  });

  test("se están analizando de verdad los archivos del backend", () => {
    // Sin esto, un fallo al recorrer el árbol dejaría el guardián pasando en
    // vacío, que es justo el modo de fallo silencioso que queremos evitar.
    const sources = readConvexSources();
    expect(sources.length).toBeGreaterThan(10);
    const helpers = collectAsyncHelpers(sources);
    expect(helpers.has("requireActor")).toBe(true);
    expect(helpers.has("hasCapability")).toBe(true);
  });

  test("ningún helper async se llama sin await", () => {
    const sources = readConvexSources();
    const asyncHelpers = collectAsyncHelpers(sources);

    const discarded = sources.flatMap((source) =>
      findDiscardedCalls(source, asyncHelpers),
    );

    const report = discarded
      .map(
        ({ path, line, name, snippet }) =>
          `${path}:${line}  falta await: ${name}()\n      ${snippet}`,
      )
      .join("\n");

    expect(
      report,
      "Un helper async sin await hace que un rechazo se pierda y la mutación\n" +
        "continúe sin aplicar sus comprobaciones. Añade el await (o `void` si\n" +
        "el descarte es deliberado):\n\n" +
        report,
    ).toBe("");
  });
});
