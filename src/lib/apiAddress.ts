/**
 * La dirección pública de la API, mirada desde el navegador: ¿responde?
 *
 * La app no habla con el backend por el mismo sitio desde el que se abre: los
 * datos van por la **dirección pública de la API** (`CONVEX_CLOUD_ORIGIN`, la que
 * se grabó dentro del sitio al compilarlo). Cuando esa dirección no responde
 * desde este navegador, lo que se ve es una app que arranca y no llega a nada
 * —queda cargando, o devuelve a la pantalla de entrada—, y sin una explicación
 * eso se parece demasiado a «el taller está roto».
 *
 * Aquí está lo que se puede saber sin preguntarle a nadie más que al navegador:
 *
 *   - si la app ha llegado a hablar con la API (`everConnected`), que es la
 *     verdad de la conexión en vivo: la que se cae cuando el proxy inverso del
 *     NAS no deja pasar el WebSocket;
 *   - y si una petición normal contesta (`addressAnswers`), que distingue «no
 *     contesta nada» de «contesta, pero la conexión en vivo no entra».
 *
 * Las dos cosas juntas dan tres casos, y cada uno se arregla de una manera
 * distinta, así que el aviso dice cuál. Se espera un margen antes de decir nada
 * —una API recién arrancada tarda— y en cuanto la app conecta, el aviso se va
 * solo: no hay nada que cerrar a mano.
 *
 * Lo mismo sirve para los enlaces del expediente: un documento se abre por esa
 * misma dirección, así que `addressTrouble` dice, antes de ofrecer el enlace, si
 * se sabe que no va a llevar a ninguna parte.
 */

import { originOf } from "./attachment";

/** Cuánto se espera a que la API conteste antes de dar por hecho que no lo hará. */
export const API_GRACE_MS = 8000;

/** Cuánto se espera a que una dirección conteste, en una comprobación suelta. */
export const ANSWER_TIMEOUT_MS = 4000;

/**
 * La dirección de la API en forma de página web: el cliente de Convex la usa por
 * WebSocket (`wss://`), pero para preguntarle si contesta hace falta su forma
 * `http(s)://`. Se le quita el camino —de la API solo interesa la casa— y, si no
 * se puede leer, se devuelve `null`.
 */
export function httpOriginOf(url: string | null | undefined): string | null {
  const origin = originOf(url);
  if (origin !== null) return origin.replace(/^ws/, "http");
  // Una dirección sin origen legible (relativa, a medio escribir) no se puede
  // preguntar; se dice con la dirección tal y como venía.
  const clean = String(url ?? "")
    .trim()
    .replace(/\/+$/, "");
  return clean === "" ? null : clean;
}

/**
 * ¿Contesta esa dirección desde este navegador? Se pregunta con una petición
 * «opaca» (`no-cors`), que es la única forma de preguntarle a un sitio que no da
 * permiso de lectura: el navegador contesta que sí en cuanto el servidor
 * responde algo —aunque sea un 403—, y contesta que no cuando no hay nadie al
 * otro lado (el dominio no resuelve, el puerto está cerrado, el HTTPS no está
 * puesto, la página es HTTPS y la dirección HTTP).
 *
 * Es justo lo que hace falta aquí: lo que se quiere saber no es *qué* contesta,
 * sino **si hay alguien**.
 */
export async function addressAnswers(
  url: string | null | undefined,
  {
    fetchImpl,
    timeoutMs = ANSWER_TIMEOUT_MS,
  }: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<boolean> {
  const address = httpOriginOf(url);
  if (address === null) return false;
  const request = fetchImpl ?? globalThis.fetch;
  if (typeof request !== "function") return true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await request(address, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Lo que se dice cuando la dirección de la API no da señales de vida. */
export interface ApiAddressTrouble {
  /** El motivo en dos o tres palabras, para el titular del aviso. */
  reason: string;
  /** La explicación: qué pasa y por dónde se arregla. */
  detail: string;
  /** La dirección que no responde. */
  address: string;
}

/**
 * Lo que hay que contar, o `null` si no hay nada que contar. Los datos que hacen
 * falta para juzgarlo se pasan a mano (las pruebas lo hacen); el enganche que lo
 * usa en la app los lee del navegador.
 */
export function apiAddressTrouble({
  apiUrl,
  pageProtocol = null,
  everConnected = false,
  connected = false,
  waitedMs = 0,
  answers = null,
  graceMs = API_GRACE_MS,
}: {
  /** La dirección de la API con la que se compiló el sitio. */
  apiUrl?: string | null;
  /** El protocolo de la página («https:»), para el caso del contenido mixto. */
  pageProtocol?: string | null;
  /** ¿Ha llegado a hablar con la API en algún momento de esta sesión? */
  everConnected?: boolean;
  /** ¿Está hablando con ella ahora mismo? */
  connected?: boolean;
  /** Cuánto lleva la app intentándolo. */
  waitedMs?: number;
  /** ¿Contesta una petición normal? `null` mientras no se haya preguntado. */
  answers?: boolean | null;
  graceMs?: number;
}): ApiAddressTrouble | null {
  // Si la app habla con la API, la dirección funciona: no hay nada que decir,
  // por mucho que una petición suelta se haya quedado sin respuesta.
  if (everConnected || connected) return null;
  // Aún tiene su margen: un backend que arranca tarda, y avisar antes de tiempo
  // asusta sin motivo.
  if (waitedMs < graceMs) return null;

  const address = httpOriginOf(apiUrl);
  if (address === null) return null;

  // La página va por HTTPS y la API por HTTP: el navegador no llama a la API
  // —bloquea el contenido mixto antes de intentarlo—, así que no hay nada que
  // esperar y sí algo muy concreto que arreglar.
  if (pageProtocol === "https:" && address.startsWith("http://")) {
    return {
      reason: "Sin HTTPS",
      detail:
        "La app se abre por HTTPS y la dirección de la API es HTTP, así que el navegador no la llama: bloquea el contenido mixto antes de intentarlo. En el `.env` del NAS, `CONVEX_CLOUD_ORIGIN` tiene que ser la dirección `https://` de la API (la que sirve el proxy inverso de DSM, con su certificado).",
      address,
    };
  }

  // Contesta a una petición, pero la conexión en vivo no entra: es la avería
  // clásica del NAS, y la que más veces se queda sin explicación.
  if (answers === true) {
    return {
      reason: "Solo a medias",
      detail:
        "La dirección contesta, pero la app no consigue abrir su conexión en vivo con la API, que es por donde llegan los datos. Casi siempre es la regla del proxy inverso del NAS, que no tiene activado el WebSocket en su encabezado personalizado: mira el paso 6 de la guía.",
      address,
    };
  }

  return {
    reason: "No responde",
    detail: `El navegador no consigue llegar a ${address}, que es la dirección pública de la API con la que se compiló la app. Con el backend en marcha, mira que la dirección sea la que de verdad usas para entrar (en el \`.env\` del NAS, \`CONVEX_CLOUD_ORIGIN\`) y que resuelva y esté publicada desde aquí.`,
    address,
  };
}

/**
 * Lo que se dice de un documento del expediente que se ha pedido y no ha
 * llegado: el navegador preguntó por el archivo y no le contestó nadie. Casi
 * siempre es la misma avería que la del aviso del panel —la dirección de la API
 * no responde desde aquí, y el archivo se sirve por esa misma dirección—, así que
 * el aviso lo manda a mirarlo allí, y deja abierto que haya sido un corte.
 */
export function unreachableDocument(address: string): ApiAddressTrouble {
  const clean = httpOriginOf(address) ?? address;
  return {
    reason: "No responde",
    detail: `El navegador ha pedido este documento y no le ha contestado nadie en ${clean}. Es la dirección de la API del taller, por la que también van los datos y las fotos: si el aviso de arriba dice que no llega nada, el motivo es el mismo; si los datos sí llegan, vuelve a comprobarlo, que puede haber sido un corte pasajero.`,
    address: clean,
  };
}

/**
 * Lo que se sabe **antes** de ofrecer un enlace del expediente: el navegador no
 * carga un archivo servido por HTTP dentro de una página HTTPS, ni va a buscar un
 * archivo a un sitio que no es el de la API. Son las dos cosas que se pueden
 * saber sin pedirlo, y las dos se arreglan en el mismo sitio que el resto
 * (`CONVEX_CLOUD_ORIGIN`), así que el enlace se calla y lo dice.
 *
 * Lo que no se puede saber sin pedirlo —si el archivo sigue en el almacén— no
 * sale de aquí: para eso está la comprobación del navegador (`addressAnswers`) y,
 * cuando el propio backend ya sabe que no hay archivo, no llega ni dirección.
 */
export function addressTrouble(
  url: string | null | undefined,
  {
    apiUrl,
    pageProtocol = null,
  }: { apiUrl?: string | null; pageProtocol?: string | null } = {},
): ApiAddressTrouble | null {
  const address = httpOriginOf(url);
  if (address === null) return null;

  if (pageProtocol === "https:" && address.startsWith("http://")) {
    return {
      reason: "Sin HTTPS",
      detail:
        "La app se abre por HTTPS y este documento se sirve por HTTP, así que el navegador no lo carga (contenido mixto). En el `.env` del NAS, `CONVEX_CLOUD_ORIGIN` tiene que ser la dirección `https://` de la API.",
      address,
    };
  }

  const api = httpOriginOf(apiUrl);
  if (api !== null && address !== api) {
    return {
      reason: "Otra dirección",
      detail: `Este documento se sirve desde ${originOf(url)}, y la app habla con la API en ${api}. Son dos direcciones distintas: casi siempre es que \`CONVEX_CLOUD_ORIGIN\` (la dirección pública de la API) no es la que usa el navegador.`,
      address,
    };
  }

  return null;
}
