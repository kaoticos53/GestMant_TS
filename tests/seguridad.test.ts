import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const DIR_SRC = join(RAIZ, "src");
const DIR_BACKEND = join(RAIZ, "src", "convex");

interface Fuente {
  ruta: string;
  codigo: string;
  tree: ts.SourceFile;
}

/** Recorre recursivamente un directorio recogiendo archivos con extensiones dadas. */
function listarArchivos(dir: string, extensiones: string[]): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      if (entrada !== "_generated" && entrada !== "node_modules") {
        encontrados.push(...listarArchivos(completo, extensiones));
      }
    } else if (
      extensiones.some((ext) => entrada.endsWith(ext)) &&
      !entrada.endsWith(".d.ts")
    ) {
      encontrados.push(completo);
    }
  }
  return encontrados.sort();
}

/** Carga y parsea fuentes TypeScript. */
function cargarFuentes(dir: string, extensiones = [".ts", ".tsx"]): Fuente[] {
  return listarArchivos(dir, extensiones).map((completo) => {
    const codigo = readFileSync(completo, "utf8");
    return {
      ruta: relative(RAIZ, completo).split(sep).join("/"),
      codigo,
      tree: ts.createSourceFile(
        completo,
        codigo,
        ts.ScriptTarget.Latest,
        true,
      ),
    };
  });
}

const FUENTES_BACKEND = cargarFuentes(DIR_BACKEND, [".ts"]);
const FUENTES_FRONTEND_Y_LIB = cargarFuentes(DIR_SRC, [".ts", ".tsx"]);

describe("Guardrails de Seguridad y AppSec (tests/seguridad.test.ts)", () => {
  describe("1. Autenticación y Autorización en Mutaciones Públicas de Convex", () => {
    const PATRONES_AUTENTICACION = [
      "getAuthUserId",
      "getAuthSessionId",
      "require", // Cubre requireUser, requireAdmin, requireManager, requireActor, requireCoordinator, etc.
      "hasCapability",
      "getAdminActor",
      "auth.getUserId",
      "registerIncidentIntake", // Formulario público de intake
    ];

    test("ninguna mutación pública carece de comprobación de identidad o sesión", () => {
      const mutacionesSinAuth: { ruta: string; mutacion: string; linea: number }[] = [];

      for (const fuente of FUENTES_BACKEND) {
        // schema.ts define tipos y tablas, no callbacks
        if (fuente.ruta.endsWith("schema.ts")) continue;

        // Inspeccionar declaraciones exportadas que sean mutation({...})
        for (const statement of fuente.tree.statements) {
          if (
            ts.isVariableStatement(statement) &&
            statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
          ) {
            for (const decl of statement.declarationList.declarations) {
              if (
                decl.initializer &&
                ts.isCallExpression(decl.initializer) &&
                ts.isIdentifier(decl.initializer.expression) &&
                decl.initializer.expression.text === "mutation"
              ) {
                const nombreMutacion = decl.name.getText(fuente.tree);
                const codigoMutacion = decl.initializer.getText(fuente.tree);

                // Puertas públicas expresas del formulario de reporte anónimo con rate limit
                const esIntakePublico =
                  (fuente.ruta.endsWith("reportUploads.ts") &&
                    nombreMutacion === "generateUploadUrl" &&
                    codigoMutacion.includes("MAX_UPLOADS_PER_HOUR")) ||
                  codigoMutacion.includes("registerIncidentIntake");

                const tieneComprobacion =
                  esIntakePublico ||
                  PATRONES_AUTENTICACION.some((patron) =>
                    codigoMutacion.includes(patron),
                  );

                if (!tieneComprobacion) {
                  const linea =
                    fuente.tree.getLineAndCharacterOfPosition(decl.getStart(fuente.tree))
                      .line + 1;
                  mutacionesSinAuth.push({
                    ruta: fuente.ruta,
                    mutacion: nombreMutacion,
                    linea,
                  });
                }
              }
            }
          }
        }
      }

      const informe = mutacionesSinAuth
        .map((m) => `${m.ruta}:${m.linea}  mutación «${m.mutacion}» no invoca comprobación de identidad`)
        .join("\n");

      expect(
        informe,
        "Se encontraron mutaciones públicas sin comprobación de identidad (getAuthUserId / requireUser / requireAdmin):\n\n" +
          informe,
      ).toBe("");
    });
  });

  describe("2. Prohibición de Correos Hardcodeados para Elevación de Privilegios", () => {
    test("ningún archivo fuente hardcodea un correo literal para otorgar rol admin", () => {
      const hallazgos: string[] = [];

      // Prohibir patrones como: email === "admin@..." o correo asignando "admin" directamente
      const regexHardcodedAdmin =
        /(?:email|correo)\s*===?\s*["'][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}["']\s*(?:\?|&&|=>|{)[^;}]*admin/i;

      for (const fuente of FUENTES_BACKEND) {
        if (fuente.ruta.endsWith("seed.ts")) continue; // Muestra de datos de prueba
        if (regexHardcodedAdmin.test(fuente.codigo)) {
          hallazgos.push(
            `${fuente.ruta} parece comparar un correo hardcodeado para asignar admin. Usa process.env.INITIAL_ADMIN_EMAIL.`,
          );
        }
      }

      expect(hallazgos).toEqual([]);
    });
  });

  describe("3. Prevención de Ejecución de Código Inseguro (CWE-94 / CWE-79)", () => {
    test("cero usos de eval() o new Function() en todo el código fuente", () => {
      const usosInseguros: string[] = [];

      for (const fuente of FUENTES_FRONTEND_Y_LIB) {
        const visitar = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            if (
              ts.isIdentifier(node.expression) &&
              node.expression.text === "eval"
            ) {
              const linea =
                fuente.tree.getLineAndCharacterOfPosition(node.getStart(fuente.tree))
                  .line + 1;
              usosInseguros.push(`${fuente.ruta}:${linea} usa eval()`);
            }
          }
          if (ts.isNewExpression(node)) {
            if (
              ts.isIdentifier(node.expression) &&
              node.expression.text === "Function"
            ) {
              const linea =
                fuente.tree.getLineAndCharacterOfPosition(node.getStart(fuente.tree))
                  .line + 1;
              usosInseguros.push(`${fuente.ruta}:${linea} usa new Function()`);
            }
          }
          ts.forEachChild(node, visitar);
        };
        visitar(fuente.tree);
      }

      expect(usosInseguros).toEqual([]);
    });

    test("dangerouslySetInnerHTML está estrictamente restringido a componentes autorizados", () => {
      const archivosPermitidos = new Set([
        "src/components/ui/chart.tsx", // Generación interna de estilos CSS de shadcn/recharts
      ]);

      const usosNoPermitidos: string[] = [];

      for (const fuente of FUENTES_FRONTEND_Y_LIB) {
        if (archivosPermitidos.has(fuente.ruta)) continue;
        if (fuente.codigo.includes("dangerouslySetInnerHTML")) {
          usosNoPermitidos.push(
            `${fuente.ruta} usa dangerouslySetInnerHTML fuera de los componentes permitidos`,
          );
        }
      }

      expect(usosNoPermitidos).toEqual([]);
    });
  });

  describe("4. Inmutabilidad y Persistencia de la Tabla de Auditoría", () => {
    test("RESET_TABLES en workshopReset.ts no incluye securityAuditLog", () => {
      const rutaReset = join(RAIZ, "src", "convex", "workshopReset.ts");
      const contenido = readFileSync(rutaReset, "utf8");

      expect(contenido).not.toMatch(/["']securityAuditLog["']/);
      expect(contenido).toContain("logSecurityEvent");
      expect(contenido).toContain("workshop_reset");
    });
  });

  describe("5. Validación Estricta de Ficheros y Prevención de DoS", () => {
    test("upload.ts define límites de tamaño de archivo y validación de magic bytes para PDF", () => {
      const rutaUpload = join(RAIZ, "src", "lib", "upload.ts");
      const contenido = readFileSync(rutaUpload, "utf8");

      expect(contenido).toContain("MAX_MANUAL_FILE_SIZE");
      expect(contenido).toContain("looksLikePdf");
      expect(contenido).toContain("0x25"); // '%'
      expect(contenido).toContain("0x50"); // 'P'
      expect(contenido).toContain("0x44"); // 'D'
      expect(contenido).toContain("0x46"); // 'F'
    });
  });
});
