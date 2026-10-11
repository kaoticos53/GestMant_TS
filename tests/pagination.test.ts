import { describe, expect, test } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_ROWS_FIT,
  MIN_ROWS_FIT,
  clampPage,
  pageCount,
  pageSummary,
  pageWindow,
  paginate,
  rowsThatFit,
} from "../src/lib/pagination";

/**
 * La aritmética de la paginación: cuántas filas caben, en qué página se está,
 * cuántas hay y qué trozo se pinta. Todo esto se decide sin pintar nada, así que
 * se prueba sin navegador; lo que se mide de la pantalla —el enganche que lee el
 * alto del área y el de una fila— se prueba en `rowsThatFit.test.tsx`, y el pie
 * de la tabla, montado de verdad, en `tablePagination.test.tsx`.
 *
 * Lo que se cuida aquí son los bordes, que es donde una tabla se rompe: la lista
 * vacía, una página que ya no existe, la última página a medias y una medida del
 * alto que no sirve.
 */

describe("pageCount — cuántas páginas salen", () => {
  test("sin filas hay una página: la vacía", () => {
    expect(pageCount(0, 10)).toBe(1);
  });

  test("las filas justas no añaden una página de más", () => {
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(20, 10)).toBe(2);
  });

  test("una fila de más abre otra página", () => {
    expect(pageCount(11, 10)).toBe(2);
    expect(pageCount(140, 25)).toBe(6);
  });
});

describe("clampPage — la página que de verdad se puede enseñar", () => {
  test("la cero y las negativas son la primera", () => {
    expect(clampPage(0, 140, 10)).toBe(1);
    expect(clampPage(-4, 140, 10)).toBe(1);
  });

  test("una página que ya no existe se acerca a la última", () => {
    // 140 filas en páginas de 10: la 99 no existe, la 14 sí.
    expect(clampPage(99, 140, 10)).toBe(14);
    expect(clampPage(2, 5, 10)).toBe(1);
  });

  test("un número que no es número no deja la tabla en el aire", () => {
    expect(clampPage(Number.NaN, 140, 10)).toBe(1);
    expect(clampPage(2.7, 140, 10)).toBe(2);
  });
});

describe("pageWindow — el trozo que se pinta", () => {
  test("la primera página empieza en la fila 1 y acaba en el tamaño elegido", () => {
    expect(pageWindow(140, 1, 10)).toEqual({
      page: 1,
      pages: 14,
      pageSize: 10,
      total: 140,
      from: 1,
      to: 10,
    });
  });

  test("la segunda sigue donde acabó la primera", () => {
    const window = pageWindow(140, 2, 10);
    expect(window.from).toBe(11);
    expect(window.to).toBe(20);
  });

  test("la última página puede quedar a medias", () => {
    const window = pageWindow(23, 3, 10);
    expect(window.page).toBe(3);
    expect(window.from).toBe(21);
    expect(window.to).toBe(23);
  });

  test("pedir una página que no existe devuelve la que sí", () => {
    expect(pageWindow(23, 9, 10).page).toBe(3);
  });

  test("sin filas no hay nada que numerar", () => {
    expect(pageWindow(0, 3, 10)).toEqual({
      page: 1,
      pages: 1,
      pageSize: 10,
      total: 0,
      from: 0,
      to: 0,
    });
  });
});

describe("paginate — la página con sus filas", () => {
  const LISTA = Array.from({ length: 23 }, (_, index) => index + 1);

  test("devuelve solo las filas de esa página", () => {
    expect(paginate(LISTA, 1, 10).rows).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(paginate(LISTA, 2, 10).rows).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(paginate(LISTA, 3, 10).rows).toEqual([21, 22, 23]);
  });

  test("una página de más devuelve la última, no la nada", () => {
    const beyond = paginate(LISTA, 7, 10);
    expect(beyond.page).toBe(3);
    expect(beyond.rows).toEqual([21, 22, 23]);
  });

  test("la lista original no se toca", () => {
    const copia = [...LISTA];
    paginate(LISTA, 2, 10);
    expect(LISTA).toEqual(copia);
  });

  test("sin filas, la página está vacía", () => {
    expect(paginate([], 1, 10).rows).toEqual([]);
  });
});

describe("pageSummary — el recuento que se lee", () => {
  const nouns = { singular: "repuesto", plural: "repuestos" };

  test("dice por dónde va la página y cuánto hay", () => {
    expect(pageSummary({ from: 1, to: 10, total: 140 }, nouns)).toBe(
      "Mostrando 1 a 10 de 140 repuestos",
    );
    expect(pageSummary({ from: 21, to: 23, total: 23 }, nouns)).toBe(
      "Mostrando 21 a 23 de 23 repuestos",
    );
  });

  test("una sola fila se dice en singular, y sin rango", () => {
    expect(pageSummary({ from: 11, to: 11, total: 11 }, nouns)).toBe(
      "Mostrando el 11 de 11 repuestos",
    );
    expect(pageSummary({ from: 1, to: 1, total: 1 }, nouns)).toBe(
      "Mostrando el 1 de 1 repuesto",
    );
  });

  test("sin filas se dice sin ellas", () => {
    expect(pageSummary({ from: 0, to: 0, total: 0 }, nouns)).toBe(
      "Sin repuestos",
    );
  });
});

describe("rowsThatFit — las filas que caben en el alto", () => {
  test("la cabecera y las filas se reparten el alto del área", () => {
    // De 480 px de área, 40 se los lleva la cabecera: 440 entre filas de 60.
    expect(rowsThatFit({ available: 480, header: 40, row: 60 })).toBe(7);
  });

  test("no se cuenta media fila", () => {
    // Cuatro filas de 90 y pico no son cinco: la quinta queda cortada.
    expect(rowsThatFit({ available: 480, header: 40, row: 90 })).toBe(4);
    expect(rowsThatFit({ available: 419, header: 40, row: 60 })).toBe(6);
    // Justo al límite: 440 entre 60 sí da siete.
    expect(rowsThatFit({ available: 460, header: 20, row: 60 })).toBe(7);
  });

  test("sin cabecera que descontar caben las que entren", () => {
    expect(rowsThatFit({ available: 480, row: 60 })).toBe(8);
    // Una cabecera sin medida no se inventa alto: es como si no la hubiera.
    expect(rowsThatFit({ available: 480, header: Number.NaN, row: 60 })).toBe(8);
  });

  test("siempre se ve una fila entera, aunque no quepa", () => {
    // Un área mínima con cabecera y fila altas: no cabe ninguna, pero la tabla
    // no puede quedarse sin filas.
    expect(rowsThatFit({ available: 90, header: 80, row: 60 })).toBe(
      MIN_ROWS_FIT,
    );
    expect(rowsThatFit({ available: 1, row: 60 })).toBe(MIN_ROWS_FIT);
  });

  test("una medida que no sirve deja el tamaño de siempre", () => {
    // El área sin pintar (cero), una medida al revés, o un navegador que no sabe
    // decir cuánto mide: se vuelve a lo que había antes de contar.
    for (const available of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rowsThatFit({ available, row: 60 })).toBe(DEFAULT_PAGE_SIZE);
    }
    for (const row of [0, -60, Number.NaN]) {
      expect(rowsThatFit({ available: 480, row })).toBe(DEFAULT_PAGE_SIZE);
    }
  });

  test("una medida imposible no pide media lista de una vez", () => {
    expect(rowsThatFit({ available: 1_000_000, row: 1 })).toBe(MAX_ROWS_FIT);
  });
});
