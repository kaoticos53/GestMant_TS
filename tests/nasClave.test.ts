/**
 * «La contraseña del NAS se teclea una sola vez»: aquí se prueban las piezas que la
 * reparten —el **ayudante** que se la da a `ssh`, el **envoltorio** que se les pone
 * delante a los guiones que corren dentro del NAS, y las **palabras** con las que
 * viaja por la entrada estándar— y, ejecutadas de verdad, las dos mitades que
 * importan: el ayudante contesta la contraseña cuando `ssh` la pide (y solo
 * entonces), y con el envoltorio `sudo` la recibe sin preguntar.
 *
 * Lo único que no se prueba aquí es lo que hace OpenSSH por dentro —llamar al
 * ayudante en vez de preguntar por la terminal—, que es justo lo que se comprueba
 * lanzando el comando contra el NAS.
 *
 * Dos reglas que estas pruebas vigilan de cerca, porque son las que hacen que esto
 * se pueda usar sin miedo: la contraseña **no viaja en la línea de órdenes** (ni,
 * por tanto, en un `ps`) y **no se escribe en ningún archivo** —el ayudante la lee
 * del entorno—.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  AYUDANTE_ARCHIVO,
  AYUDANTE_CARPETA,
  PALABRA_CLAVE_PASAR,
  PALABRAS_CLAVE_LEER,
  VAR_CLAVE,
  ayudanteContenido,
  conClave,
  entornoAyudante,
  envoltorioClave,
  esSshDeMsys,
  haceFaltaClave,
  ordenPrepararAyudante,
  ordenQuitarAyudante,
} from "../scripts/nas-clave-lib.mjs";
import { scriptWords } from "../scripts/nas-setup-lib.mjs";

/** Windows → la ruta que entiende el `sh` de Git Bash (`/c/Users/...`). */
const shPath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);

/** ¿Hay un `sh` de verdad? Sin él, lo que se ejecuta de verdad no corre. */
const shListo =
  spawnSync("sh", ["-c", "command -v cat printf"], { encoding: "utf8" })
    .status === 0;

/** Una contraseña con de todo, para que nada se dé por hecho con las simples. */
const CLAVE_RARA = "cazuela con 'comillas'; y espacios";

/**
 * Un `sudo` de mentira que apunta con qué argumentos le llaman y lo que lee por su
 * entrada estándar: es exactamente lo que hay que mirar para saber si el envoltorio
 * le está dando la contraseña o si le tocaría preguntarla.
 */
function montarSudo() {
  const base = mkdtempSync(join(tmpdir(), "pulso-clave-"));
  const bin = join(base, "bin");
  mkdirSync(bin);
  const path = join(bin, "sudo");
  // Y los argumentos uno por uno, entre corchetes: `$*` se come los vacíos, y aquí
  // el `-p ''` —el aviso en blanco de `sudo`— es justo uno de los que hay que ver.
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      "printf 'argumento:[%s]\\n' \"$@\"",
      "printf 'entrada:%s\\n' \"$(cat)\"",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return { base, bin };
}

/**
 * Ejecuta una orden en el `sh` con el `sudo` de mentira por delante, como lo haría
 * el guion dentro del NAS. El `PATH` se compone **dentro** del propio `sh`: al
 * lanzar un proceso, Node tiene que encontrar el ejecutable con las reglas de
 * Windows, y una ruta de estas —«/c/…»— no la entiende.
 */
function correr(
  orden: string,
  {
    bin,
    entorno = {},
    entrada = "",
  }: { bin: string; entorno?: Record<string, string>; entrada?: string },
) {
  const asignaciones = Object.entries(entorno)
    .map(([clave, valor]) => `${clave}='${valor}'`)
    .join(" ");
  return spawnSync(
    "sh",
    ["-c", `PATH='${shPath(bin)}':"$PATH" ${asignaciones} ${orden}`],
    { encoding: "utf8", input: entrada },
  );
}

/* ------------------------------------------------------------------ */
/* El ayudante que le da la contraseña a ssh                           */
/* ------------------------------------------------------------------ */

describe.skipIf(!shListo)("el ayudante de la contraseña", () => {
  test("la contesta cuando ssh la pide, y no contesta ninguna otra pregunta", () => {
    const { base } = montarSudo();
    const ayudante = join(base, "ayudante.sh");
    writeFileSync(ayudante, ayudanteContenido());
    chmodSync(ayudante, 0o755);

    // La llamada de `ssh`: el ayudante recibe la pregunta como primer argumento.
    const pide = spawnSync(
      "sh",
      [shPath(ayudante), "ricardo@192.168.0.47's password: "],
      {
        encoding: "utf8",
        env: { ...process.env, [VAR_CLAVE]: "cazuela" },
      },
    );
    expect(pide.stdout).toBe("cazuela\n");

    // Y a la confirmación de la clave del servidor no se le contesta la contraseña:
    // eso hay que leerlo y decidirlo, no repetir un secreto a ciegas.
    const confirma = spawnSync(
      "sh",
      [
        shPath(ayudante),
        "Are you sure you want to continue connecting (yes/no)?",
      ],
      { encoding: "utf8", env: { ...process.env, [VAR_CLAVE]: "cazuela" } },
    );
    expect(confirma.status).not.toBe(0);
    expect(confirma.stdout).toBe("");
  });

  test("el archivo no lleva ningún secreto dentro: la lee del entorno", () => {
    const contenido = ayudanteContenido();
    expect(contenido).toContain(`"$${VAR_CLAVE}"`);
    expect(contenido).not.toContain("cazuela");
  });

  test("se escribe con finales de línea de Unix, que es quien lo ejecuta", () => {
    // La misma lección que con los guiones del NAS: un `\r` deja el `#!` roto y la
    // shell busca un intérprete que se llama `/bin/sh\r`.
    const contenido = ayudanteContenido();
    expect(contenido.startsWith("#!/bin/sh\n")).toBe(true);
    expect(contenido).not.toContain("\r");
  });
});

describe("lo que se le da a ssh para que no pregunte", () => {
  test("el entorno lleva el ayudante, forzado, y la clave solo para él", () => {
    expect(entornoAyudante("cazuela")).toEqual({
      SSH_ASKPASS: AYUDANTE_ARCHIVO,
      SSH_ASKPASS_REQUIRE: "force",
      [VAR_CLAVE]: "cazuela",
    });
  });

  test("el ayudante se deja listo y se recoge", () => {
    // El archivo vive en el mundo del `sh` —el `/tmp` de MSYS—, así que se mira con
    // él: desde Node, esa ruta no existe (sería `«disco»:\tmp`).
    const preparado = spawnSync("sh", ["-c", ordenPrepararAyudante()], {
      encoding: "utf8",
      input: ayudanteContenido(),
    });
    expect(preparado.status).toBe(0);
    const leido = spawnSync("sh", ["-c", `cat ${AYUDANTE_ARCHIVO}`], {
      encoding: "utf8",
    });
    expect(leido.stdout).toBe(ayudanteContenido());

    // Y al terminar no queda nada suelto en `/tmp`.
    const quitado = spawnSync("sh", ["-c", ordenQuitarAyudante()], {
      encoding: "utf8",
    });
    expect(quitado.status).toBe(0);
    const sigue = spawnSync(
      "sh",
      ["-c", `[ -e ${AYUDANTE_CARPETA} ] && echo si || echo no`],
      {
        encoding: "utf8",
      },
    );
    expect(sigue.stdout.trim()).toBe("no");
  });
});

describe("las dos clases de ssh", () => {
  test("el de Windows no admite el ayudante; el de Git Bash, sí", () => {
    expect(esSshDeMsys("OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2")).toBe(
      false,
    );
    expect(esSshDeMsys("OpenSSH_10.5p1, OpenSSL 3.5.7 9 Jun 2026")).toBe(true);
  });
});

describe("cuándo hay que preguntar la contraseña", () => {
  test("solo cuando el NAS la pide", () => {
    expect(
      haceFaltaClave(
        "ricardo@192.168.0.47: Permission denied (publickey,password).",
      ),
    ).toBe(true);
    // Un host que no resuelve, un puerto cerrado o una conexión que se agota dicen
    // otra cosa: preguntarla ahí sería molestar para nada.
    expect(
      haceFaltaClave(
        "ssh: Could not resolve hostname nas: Name or service not known",
      ),
    ).toBe(false);
    expect(
      haceFaltaClave(
        "ssh: connect to host 192.168.0.47 port 22: Connection timed out",
      ),
    ).toBe(false);
    expect(haceFaltaClave("")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* El envoltorio de sudo, ejecutado de verdad                          */
/* ------------------------------------------------------------------ */

describe.skipIf(!shListo)(
  "el envoltorio con el que sudo recibe la clave",
  () => {
    test("con clave, la recibe por la entrada estándar y no pregunta", () => {
      const { bin } = montarSudo();
      const salida = correr(
        [
          "#!/bin/sh",
          envoltorioClave(),
          'echo "con_clave=$con_clave"',
          "SUDO=sudo",
          "$SUDO docker compose up -d",
        ].join("\n"),
        { bin, entorno: { [VAR_CLAVE]: "cazuela" } },
      );
      expect(salida.stdout).toContain("con_clave=si");
      // El `-S` —leer la contraseña de la entrada— es lo que hace que no pregunte, y
      // el `-p ''` es para que ni siquiera escriba un aviso. La orden de dentro llega
      // entera.
      expect(salida.stdout).toContain("argumento:[-S]");
      expect(salida.stdout).toContain("argumento:[-p]");
      expect(salida.stdout).toContain("argumento:[]");
      expect(salida.stdout).toContain("argumento:[docker]");
      expect(salida.stdout).toContain("argumento:[compose]");
      expect(salida.stdout).toContain("entrada:cazuela");
    });

    test("sin clave no se define nada: manda el sudo de siempre", () => {
      const { bin } = montarSudo();
      const salida = correr(
        [
          "#!/bin/sh",
          envoltorioClave(),
          'echo "con_clave=$con_clave"',
          "SUDO=sudo",
          "$SUDO docker info",
        ].join("\n"),
        { bin },
      );
      expect(salida.stdout).toContain("con_clave=no");
      // Ni `-S` ni nada por la entrada: el `sudo` del NAS preguntará lo que tenga que
      // preguntar, que es lo que pasa al lanzar el guion a mano en el NAS.
      expect(salida.stdout).toContain("argumento:[docker]");
      expect(salida.stdout).toContain("argumento:[info]");
      expect(salida.stdout).toContain("entrada:\n");
      expect(salida.stdout).not.toContain("[-S]");
    });

    test("el binario sigue a mano para quien necesita preguntarle de verdad", () => {
      // El doctor pregunta si la cuenta puede usar `sudo` sin contraseña. La pregunta
      // se le hace al binario, con `command`, tapado o no el nombre por la función: si
      // no, el resumen diría «no pide contraseña» por tenerla ya en la mano.
      const { bin } = montarSudo();
      const salida = correr(
        ["#!/bin/sh", envoltorioClave(), "command sudo -n true"].join("\n"),
        { bin, entorno: { [VAR_CLAVE]: "cazuela" } },
      );
      expect(salida.stdout).toContain("argumento:[-n]");
      expect(salida.stdout).toContain("argumento:[true]");
      expect(salida.stdout).not.toContain("[-S]");
    });

    test("la clave no viaja en la línea de órdenes", () => {
      // Solo el nombre de la variable: la resuelve la shell del NAS desde su entorno.
      // Por eso una contraseña con comillas o puntos y comas no rompe nada, y por eso
      // no aparece en ningún `ps`.
      expect(envoltorioClave()).toContain(`"$${VAR_CLAVE}"`);
      expect(envoltorioClave()).not.toContain("cazuela");
      expect(PALABRA_CLAVE_PASAR).toBe(`${VAR_CLAVE}=$${VAR_CLAVE}`);
      expect(conClave("sh guion.sh")).toBe(
        `${PALABRAS_CLAVE_LEER.join(" ")} ${VAR_CLAVE}=$${VAR_CLAVE} sh guion.sh`,
      );
    });
  },
);

/* ------------------------------------------------------------------ */
/* La clave por la entrada estándar                                    */
/* ------------------------------------------------------------------ */

describe.skipIf(!shListo)("la clave llegando por la entrada estándar", () => {
  const GUION = "printf 'la clave: %s\\n' \"${PULSO_CLAVE:-nada}\"\n";

  test("el guion que viaja en palabras la tiene en su entorno", () => {
    const palabras = scriptWords(GUION, { clave: true });
    // Lo que cruza son palabras: la clave va por la entrada, no dentro de ninguna.
    expect(palabras.join(" ")).not.toContain("cazuela");

    const salida = spawnSync("sh", ["-c", palabras.join(" ")], {
      encoding: "utf8",
      input: `${CLAVE_RARA}\n`,
    });
    // Y con comillas, espacios y puntos y comas de por medio, llega entera: es una
    // asignación, así que la shell no la parte.
    expect(salida.stdout).toContain(`la clave: ${CLAVE_RARA}`);
  });

  test("el guion del NAS la lee antes de empezar", () => {
    const base = mkdtempSync(join(tmpdir(), "pulso-clave-"));
    const guion = join(base, "guion.sh");
    writeFileSync(guion, GUION);

    const salida = spawnSync("sh", ["-c", conClave(`sh '${shPath(guion)}'`)], {
      encoding: "utf8",
      input: `${CLAVE_RARA}\n`,
    });
    expect(salida.stdout).toContain(`la clave: ${CLAVE_RARA}`);
  });

  test("sin clave tecleada, las palabras de siempre", () => {
    const palabras = scriptWords(GUION);
    expect(palabras[0]).toBe("printf");
    expect(palabras.join(" ")).not.toContain(`${VAR_CLAVE}=`);
  });
});
