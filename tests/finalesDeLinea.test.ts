import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { backupWords } from "../scripts/nas-backup-lib.mjs";
import { scriptWords } from "../scripts/nas-setup-lib.mjs";

/**
 * Los finales de línea de los guiones de shell: la avería que se lleva por delante
 * a un contenedor sin decir por qué.
 *
 * El taller se escribe en Windows y se ejecuta en Linux —el NAS y los contenedores
 * que construye—, y ahí un `\r` al final de una línea no es un espacio en blanco:
 * en el `#!` deja el intérprete en `/bin/sh\r`, que no existe, así que el proceso
 * sale con «not found» y el código 127. Y un `\r` en una línea que acabe en una
 * variable se queda dentro del valor.
 *
 * Pasó de verdad, y esta prueba es su memoria: los dos guiones que suben las
 * funciones tenían finales de línea de Windows en el repositorio, el `vigilante`
 * del NAS murió con el código 127 nada más nacer —tres veces, hasta rendirse— y en
 * sus registros solo se leía `/usr/local/bin/vigila-funciones: not found`, que no
 * habla de finales de línea. El archivo estaba donde decía.
 *
 * Se vigilan las **tres puertas** por las que un guion llega a Linux, porque cada
 * una se rompe por su cuenta:
 *
 *   1. el archivo del repositorio, que se edita en Windows y se guarda en git;
 *   2. lo que cruza por SSH para ejecutarse dentro del NAS;
 *   3. lo que entra en la imagen, que la construye el NAS desde su copia del árbol
 *      de trabajo —por `tar`, así que no pasa por git y el `.gitattributes` no
 *      llega hasta ahí—.
 */

/** La raíz, para leer los archivos tal cual están en el repositorio. */
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const DOCKERFILE = join(RAIZ, "docker", "synology", "Dockerfile");

/** Lo que no se mira: dependencias y lo que generan las herramientas. */
const IGNORADOS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "_generated",
]);

/** Los `.sh` del repositorio, con su ruta relativa para que un fallo se lea bien. */
function guiones(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (IGNORADOS.has(entrada)) continue;
    const completo = join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      encontrados.push(...guiones(completo));
    } else if (entrada.endsWith(".sh")) {
      encontrados.push(relative(RAIZ, completo).split(sep).join("/"));
    }
  }
  return encontrados.sort();
}

/** El contenido de un archivo, sin interpretarlo: aquí se miran bytes. */
const bytes = (ruta: string) => readFileSync(join(RAIZ, ruta), "latin1");

describe("los guiones del NAS, con finales de línea de Unix", () => {
  test("ninguno del repositorio se guarda con finales de línea de Windows", () => {
    const archivos = guiones(RAIZ);

    // Si esto falla, la prueba se ha quedado sin mirar nada: no vale de nada.
    expect(archivos).toContain("docker/synology/funciones.sh");
    expect(archivos).toContain("docker/synology/vigila-funciones.sh");
    expect(archivos).toContain("docker/synology/funciones-lib.sh");
    expect(archivos).toContain("docker/synology/copia-previa.sh");
    expect(archivos.length).toBeGreaterThanOrEqual(5);

    const conRetornos = archivos.filter((ruta) => bytes(ruta).includes("\r"));
    expect(conRetornos).toEqual([]);
  });

  test("git los guarda en LF, también en un Windows con core.autocrlf", () => {
    const atributos = readFileSync(join(RAIZ, ".gitattributes"), "utf8");

    expect(atributos).toMatch(/^\*\.sh\s+text\s+eol=lf\s*$/m);
  });

  test("la imagen limpia el retorno de carro antes de darles permiso", () => {
    const dockerfile = readFileSync(DOCKERFILE, "utf8");

    // La línea que limpia, con los tres guiones que entran en la imagen: así el
    // contenedor arranca igual aunque el archivo llegue con `\r` desde Windows.
    const limpieza =
      dockerfile
        .split("\n")
        .find((line) => line.includes("sed -i") && line.includes("\\r")) ?? "";
    expect(limpieza).toContain("sed -i 's/\\r$//'");
    for (const guion of ["funciones", "vigila-funciones", "funciones-lib.sh"]) {
      expect(limpieza).toContain(`/usr/local/bin/${guion}`);
    }
  });

  test("lo que cruza por SSH se limpia antes de salir", () => {
    const conWindows = "#!/bin/sh\r\necho hola\r\n";

    // El guion, en trozos entrecomillados: ni un `\r` en lo que se le da a `ssh`.
    const orden = scriptWords(conWindows).join(" ");
    expect(orden).not.toContain("\r");
    expect(orden).toContain("#!/bin/sh");
    expect(orden).toContain("echo hola");

    // Y lo mismo por el camino de la copia previa, que arma su orden aparte.
    const copia = backupWords({
      script: conWindows,
      root: "/volume1/docker/pulso-taller",
      backups: "/volume1/docker/respaldos",
      keep: "7",
    });
    expect(copia.join(" ")).not.toContain("\r");
    expect(copia.join(" ")).toContain("PULSO_RESPALDOS");
  });
});
