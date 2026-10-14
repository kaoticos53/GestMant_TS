/**
 * El código con el que se sigue un caso desde fuera del taller.
 *
 * La referencia interna —«INC-0004»— se queda dentro. Una incidencia lleva un
 * número correlativo, así que quien pruebe «1», «2», «3»… recorre la cola entera
 * sin saber nada de nadie: con una sesión de invitado bastaba para leer el
 * seguimiento de todos los casos del taller. El código corta ese camino porque no
 * dice nada de nadie: se reparte al azar y no hay forma de adivinar el de al lado.
 *
 * Tres decisiones que no son de estilo:
 *
 * - **Lo reparte el azar, no un contador.** Un código se dicta por teléfono, se
 *   copia de un correo y se apunta en un papel: tiene que ser corto y no
 *   repetirse. Con ocho caracteres de este alfabeto hay más combinaciones que
 *   personas en el mundo, así que dos talleres no chocan y nadie puede ir
 *   probando.
 * - **El alfabeto deja fuera lo que se confunde.** Ni el cero ni la O, ni el uno
 *   ni la I: al dictarlo nadie tiene que preguntar «¿es una O o un cero?». Son
 *   32 caracteres exactos, y 32 es 2^5, así que cada carácter sale de cinco bits
 *   de azar con la misma probabilidad que los demás, sin descartar bytes. La L se
 *   queda: sin ningún uno en el alfabeto, no hay nada con lo que confundirla.
 * - **Se enseña en dos grupos** —«A7K2-QX9M»—, que es como se lee, se dicta y se
 *   teclea sin perder la cuenta; por dentro es una sola cadena.
 *
 * Aquí están solo las cuentas. El reparto —mirar si el código está cogido y
 * volver a tirar— habla con la base y vive en `convex/publicCodes`.
 */

/** Los 32 caracteres del alfabeto, sin los que se confunden entre sí. */
export const PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Lo que se quita al normalizar: espacios, guiones, puntos y el guion bajo. Es lo
 * que aparece cuando el código se copia de un correo o de un papel, y quitarlo no
 * es perdonar una errata: es leer lo mismo.
 */
const SEPARATORS = /[\s_.-]+/g;

/** Cuántos caracteres tiene un código. */
export const PUBLIC_CODE_LENGTH = 8;

/** Cada cuántos caracteres se separa al enseñarlo. */
export const PUBLIC_CODE_GROUP = 4;

/**
 * Los caracteres que alguien teclea cuando ha copiado mal: no están en el
 * alfabeto justo porque se leen como otro. Se listan aquí para poder decir cuál
 * sobra en vez de un «no vale» a secas.
 */
const CONFUSABLE_CHARS = "O01I";

/**
 * Un código a partir de bytes de azar. Cada carácter se queda con cinco bits de
 * un byte —el alfabeto tiene 32 justos—, así que no hay sesgo y sobra azar.
 *
 * Pide los bytes de fuera —`crypto.getRandomValues` en la aplicación, un azar
 * reproducible en la muestra— para que esto siga siendo una cuenta sin reloj ni
 * entorno, y se pueda comprobar byte a byte.
 */
export function publicCodeFrom(bytes: Uint8Array): string {
  if (bytes.length < PUBLIC_CODE_LENGTH) {
    throw new Error(
      `Hacen falta ${PUBLIC_CODE_LENGTH} bytes de azar para repartir un código.`,
    );
  }
  let code = "";
  for (let index = 0; index < PUBLIC_CODE_LENGTH; index += 1) {
    code += PUBLIC_CODE_ALPHABET[bytes[index] & 31];
  }
  return code;
}

/**
 * El código como se enseña: en mayúsculas y en grupos de cuatro. Acepta lo que
 * se escriba —con guiones, espacios o en minúsculas— y lo deja igual, así que
 * pintar lo que ya venía pintado no cambia nada.
 */
export function formatPublicCode(code: string): string {
  const cleaned = code.replace(SEPARATORS, "").toUpperCase();
  const groups: string[] = [];
  for (let start = 0; start < cleaned.length; start += PUBLIC_CODE_GROUP) {
    groups.push(cleaned.slice(start, start + PUBLIC_CODE_GROUP));
  }
  return groups.join("-");
}

/**
 * Lo que se escribió, en su forma canónica —«a7k2 qx9m» → «A7K2QX9M»—, o `null`
 * si no hay ningún código que buscar. Se quitan espacios, guiones y puntos porque
 * así es como llega lo copiado de un correo o de un papel, y no buscarlo tal cual
 * no significa que esté mal escrito: significa que hay que decirlo.
 */
export function normalizePublicCode(
  input: string | null | undefined,
): string | null {
  const cleaned = (input ?? "").replace(SEPARATORS, "").toUpperCase();
  if (cleaned.length !== PUBLIC_CODE_LENGTH) return null;
  for (const char of cleaned) {
    if (!PUBLIC_CODE_ALPHABET.includes(char)) return null;
  }
  return cleaned;
}

/**
 * Los caracteres que no pueden formar parte de un código porque se leen como
 * otro —la O como el cero, la I como el uno—, sin repetir y en el orden en que
 * aparecen. Con esto se le puede decir a quien consulta qué sobra: un «no
 * encontramos nada» con una O tecleada de más manda a buscar donde no es.
 */
export function confusablePublicCodeChars(input: string): string {
  const found = new Set<string>();
  for (const char of input.toUpperCase()) {
    if (CONFUSABLE_CHARS.includes(char)) found.add(char);
  }
  return [...found].join("");
}
