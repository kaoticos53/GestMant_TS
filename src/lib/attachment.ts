/**
 * Qué decir cuando un adjunto no se abre.
 *
 * Los archivos del taller no viven en el sitio: viven en el almacén del backend
 * y se sirven por su **dirección pública** (`CONVEX_CLOUD_ORIGIN`), que es otra
 * distinta de la dirección en la que se abre la app. Cuando esa dirección no es
 * la que alcanza el navegador —un dominio que aún no resuelve, un HTTPS que no
 * está puesto, o un `CONVEX_CLOUD_ORIGIN` que se quedó apuntando a `localhost`—,
 * la foto no se abre. Hasta ahora eso se quedaba en el icono roto del navegador,
 * y quien mira la ficha no sabía si el archivo se había perdido o si era la
 * dirección la que estaba mal.
 *
 * Aquí está lo que la app puede deducir sin preguntarle a nadie: comparar la
 * dirección del archivo con la de la API que usa la app y con el protocolo de la
 * página. Son cuatro casos, y cada uno se arregla de una manera distinta, así que
 * el aviso dice cuál es.
 */

/** El origen («https://api.tudominio.com») de una dirección, o `null` si no se puede leer. */
export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    // Una dirección relativa o a medio escribir: no hay origen que comparar.
    return null;
  }
}

/** La dirección de la API que usa el navegador: la que se compiló dentro del sitio. */
export function apiOrigin(): string | null {
  return (
    originOf(import.meta.env.VITE_CONVEX_URL as string | undefined) ?? null
  );
}

/** El protocolo de la página («https:»), si hay navegador que lo diga. */
function pageProtocolOf(): string | null {
  return typeof window === "undefined" ? null : window.location.protocol;
}

/** Lo que se enseña en el sitio que ocupaba la foto. */
export interface AttachmentFailure {
  /** El motivo en dos o tres palabras, para el hueco pequeño de una rejilla. */
  reason: string;
  /** La explicación, para donde hay sitio: qué pasa y por dónde se arregla. */
  detail: string;
  /** La dirección que se intentó abrir. */
  address: string;
  /**
   * De quién es el fallo, que es lo que decide cuántas veces se dice:
   *
   *   - `address`: de la dirección pública de la API. Las fotos de una ficha la
   *     comparten, así que el porqué es el mismo para todas y se dice una vez,
   *     no en cada hueco.
   *   - `file`: de ese archivo y de nadie más (ya no está en el almacén, nunca
   *     llegó a tenerlo). Su aviso va en su hueco, aunque haya grupo.
   */
  blame: "address" | "file";
}

/**
 * Por qué un adjunto no se ha abierto. Los dos valores que hacen falta para
 * juzgarlo se pueden pasar a mano (las pruebas lo hacen); si no, se leen del
 * entorno: la dirección de la API con la que se compiló el sitio y el protocolo
 * de la página.
 */
export function attachmentFailure(
  url: string,
  options: { apiUrl?: string | null; pageProtocol?: string | null } = {},
): AttachmentFailure {
  const apiUrl = options.apiUrl === undefined ? apiOrigin() : options.apiUrl;
  const pageProtocol =
    options.pageProtocol === undefined
      ? pageProtocolOf()
      : options.pageProtocol;
  const fileOrigin = originOf(url);
  const fileProtocol = protocolOf(url);
  const api = originOf(apiUrl);

  const address = url;

  // El navegador no carga `http://` dentro de una página `https://`: lo bloquea
  // él, antes de pedirlo siquiera. No es que la dirección esté mal escrita, es
  // que no puede usarse desde aquí.
  if (pageProtocol === "https:" && fileProtocol === "http:") {
    return {
      reason: "Sin HTTPS",
      detail:
        "La app se abre por HTTPS y el archivo se sirve por HTTP, así que el navegador lo bloquea sin pedirlo (contenido mixto). En el `.env` del NAS, `CONVEX_CLOUD_ORIGIN` tiene que ser la dirección `https://` de la API.",
      address,
      // Es la dirección la que no puede usarse desde aquí, y todas las fotos de
      // la ficha se sirven igual: el mismo aviso vale para todas.
      blame: "address",
    };
  }

  // El sitio habla con una API y los archivos vienen de otra: esa es la avería
  // clásica del NAS, y se ve en un momento comparando los dos orígenes.
  if (fileOrigin !== null && api !== null && fileOrigin !== api) {
    return {
      reason: "Otra dirección",
      detail: `El archivo se sirve desde ${fileOrigin}, y la app habla con la API en ${api}. Son dos direcciones distintas: casi siempre es que \`CONVEX_CLOUD_ORIGIN\` (la dirección pública de la API) no es la que usa el navegador.`,
      address,
      blame: "address",
    };
  }

  // Mismo origen: los datos de la ficha han llegado por esa misma dirección, así
  // que la avería está en el archivo, no en el camino.
  if (fileOrigin !== null && api !== null) {
    return {
      reason: "Ya no está",
      detail:
        "La API responde, así que el archivo ya no está en el almacén del taller —se borró el documento o se lo llevó la limpieza— o la conexión se ha cortado a medias. El nombre y la nota del documento se conservan.",
      address,
      // La dirección llega —los datos de la ficha han venido por ella—: el que
      // falta es este archivo, y eso solo lo dice su hueco.
      blame: "file",
    };
  }

  // Sin poder comparar nada (una dirección relativa, un entorno sin datos): se
  // dice lo único que se sabe, con la dirección que ha fallado delante.
  return {
    reason: "No responde",
    detail: `No ha llegado nada de ${address}. Comprueba que la dirección pública de la API responde desde este navegador y que el archivo sigue en el almacén del taller.`,
    address,
    // Sin poder comparar nada, lo que está en duda es el camino hasta la
    // dirección, que es el mismo para todas: se cuenta como lo de la dirección.
    blame: "address",
  };
}

/**
 * Lo que se dice de un adjunto que se quedó sin archivo: el caso hermano del
 * que no se abre. Aquí no hay dirección que juzgar —el almacén ya no da
 * ninguna—, así que lo único que se puede decir es que no queda nada que abrir.
 *
 * Pasa en los dos sitios donde el archivo se cita desde fuera de su ficha —la
 * papelera del almacén y las imágenes sin usar del formulario—, donde una fila
 * sin imagen se lee como una foto que aún no ha cargado.
 */
export function missingAttachment(): AttachmentFailure {
  return {
    reason: "Sin archivo",
    detail:
      "El almacén ya no tiene el archivo de este adjunto: se borró a mano o se lo llevó la limpieza. Lo que contaba de él —su nombre, su nota y su fecha— se conserva, pero no queda nada que abrir.",
    address: "",
    // De este archivo, y de ningún otro: que a una foto le falte el archivo no
    // dice nada de las demás, así que se queda en su hueco.
    blame: "file",
  };
}

/** El protocolo («http:») de una dirección, o `null` si no se puede leer. */
function protocolOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}
