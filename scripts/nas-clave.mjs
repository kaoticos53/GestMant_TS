// Lo que de verdad toca el ordenador para teclear la contraseña del NAS una sola
// vez: **la pregunta** —a ciegas, sin eco— y **el ayudante** que se deja en el `sh`
// de MSYS para que `ssh` no vuelva a preguntar.
//
// Lo que se puede probar sin encender nada vive al lado, en `nas-clave-lib.mjs`:
// aquí solo está el trato con la terminal y con el sistema.
//
// Nada de esto escribe la contraseña en ningún archivo: el ayudante la lee del
// entorno, así que su archivo no lleva nada dentro y puede quedarse en `/tmp` sin
// cuidado mientras dura el comando (y se recoge al terminar).

import { spawnSync } from "node:child_process";

import {
  PREGUNTA_CLAVE,
  ayudanteContenido,
  entornoAyudante,
  esSshDeMsys,
  ordenPrepararAyudante,
  ordenQuitarAyudante,
} from "./nas-clave-lib.mjs";

/** La versión del `ssh` del PATH: dice de quién es y qué sabe hacer. */
export function versionDeSsh() {
  const result = spawnSync("ssh", ["-V"], { encoding: "utf8" });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

/**
 * ¿Puede el `ssh` que hay en el PATH recibir la contraseña por el ayudante?
 *
 * El de Windows no: en sus propias palabras es `OpenSSH_for_Windows`, y ni admite
 * el ayudante ni sabe reutilizar conexiones. El de Git Bash —MSYS— sí.
 */
export function admiteAyudante() {
  return esSshDeMsys(versionDeSsh());
}

/**
 * La contraseña, una vez. Se lee **tecla a tecla y sin eco**: lo que se escribe no
 * se ve, no queda en el scrollback de la terminal y no pasa por ningún archivo.
 *
 * Devuelve `null` cuando no hay terminal donde pedirla —una ejecución desatendida—
 * o cuando se teclea en vacío: eso no es una contraseña, es no querer darla, y sin
 * ella todo sigue funcionando como antes.
 */
export function pedirClave({
  entrada = process.stdin,
  salida = process.stderr,
} = {}) {
  if (!entrada.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    salida.write(`\n${PREGUNTA_CLAVE}\n`);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");

    const tecleado = [];
    const terminar = (valor) => {
      entrada.removeListener("data", alTeclear);
      entrada.setRawMode(false);
      entrada.pause();
      salida.write("\n");
      resolve(valor);
    };
    // Lo que llega por la entrada, tal cual se teclee: una tecla suelta, un pegado
    // entero de golpe, o el final de línea de cualquiera de los dos.
    const alTeclear = (tecla) => {
      if (tecla.includes("\u0003")) {
        // Ctrl-C: el comando se va, sin dejar nada a medias.
        salida.write("\n");
        process.exit(130);
      }
      const corte = tecla.search(/[\r\n]/);
      if (corte >= 0) {
        tecleado.push(tecla.slice(0, corte));
        terminar(tecleado.join("") || null);
        return;
      }
      if (tecla.includes("\u0004")) {
        terminar(tecleado.join("") || null);
        return;
      }
      // Retroceso, que en Windows llega como suprimir (0x7f) y en otros terminales
      // como 0x08.
      if (tecla === "\u007f" || tecla === "\b") {
        tecleado.pop();
        return;
      }
      // Las flechas y demás mandan secuencias de escape: aquí no se pega nada que
      // empiece por ahí, así que se ignoran en vez de acabar dentro de la clave.
      if (tecla.includes("\u001b")) return;
      tecleado.push(tecla);
    };
    entrada.on("data", alTeclear);
  });
}

/**
 * Deja el ayudante listo y devuelve lo que hay que darle a cada `ssh` —dónde está
 * y la clave para que la lea— junto con la forma de recogerlo.
 *
 * Devuelve `null` si no se ha podido preparar: entonces no se le pasa nada a `ssh`
 * y las conexiones preguntan como preguntaban, que es peor pero no rompe nada.
 *
 * Se recoge **al salir el proceso**, pase lo que pase —también si algo corta a
 * medias—: en `/tmp` no se queda nada suelto.
 */
export function prepararAyudante(clave) {
  const preparado = spawnSync("sh", ["-c", ordenPrepararAyudante()], {
    input: ayudanteContenido(),
    encoding: "utf8",
  });
  if (preparado.status !== 0) return null;

  const limpiar = () => {
    spawnSync("sh", ["-c", ordenQuitarAyudante()], { encoding: "utf8" });
  };
  process.once("exit", limpiar);
  return { entorno: entornoAyudante(clave), limpiar };
}
