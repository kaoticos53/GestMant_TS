import { describe, expect, test } from "vitest";
import {
  compareSortValues,
  directionLabel,
  flipTableSort,
  nextTableSort,
  readTableSort,
  sortFromOptionValue,
  sortOptionValue,
  sortOptions,
  sortRows,
  SORT_OPTION_ORIGINAL,
  tableSortKey,
  writeTableSort,
  type TableSort,
} from "../src/lib/tableSort";

/** Una fila de mentira: solo lo que cada columna ordena. */
interface Row {
  name: string;
  code: string;
  stock: number;
  brand?: string;
}

const code = (row: Row) => row.code;
const stock = (row: Row) => row.stock;
const brand = (row: Row) => row.brand ?? null;

describe("nextTableSort — el ciclo de una cabecera", () => {
  test("la primera pulsación ordena de menor a mayor", () => {
    expect(nextTableSort(null, "code")).toEqual({
      column: "code",
      direction: "asc",
    });
  });

  test("la segunda invierte el sentido y la tercera vuelve al orden de siempre", () => {
    const ascending = nextTableSort(null, "code");
    const descending = nextTableSort(ascending, "code");
    expect(descending).toEqual({ column: "code", direction: "desc" });
    expect(nextTableSort(descending, "code")).toBeNull();
  });

  test("cambiar de columna empieza de menor a mayor", () => {
    const sorted: TableSort<"code" | "stock"> = {
      column: "code",
      direction: "desc",
    };
    expect(nextTableSort(sorted, "stock")).toEqual({
      column: "stock",
      direction: "asc",
    });
  });
});

describe("sortRows — ordenar lo que se está viendo", () => {
  const rows: Row[] = [
    { name: "Bombilla", code: "EQ-10", stock: 3, brand: "Osram" },
    { name: "Cable", code: "EQ-2", stock: 10, brand: "Rosen" },
    { name: "Adaptador", code: "EQ-1", stock: 1 },
  ];

  test("sin columna elegida, las filas quedan como llegaron", () => {
    expect(sortRows(rows, code, null).map(code)).toEqual([
      "EQ-10",
      "EQ-2",
      "EQ-1",
    ]);
  });

  test("ordena una copia: la lista original no se toca", () => {
    const sorted = sortRows(rows, code, { column: "code", direction: "asc" });
    expect(sorted).not.toBe(rows);
    expect(rows.map(code)).toEqual(["EQ-10", "EQ-2", "EQ-1"]);
  });

  test("el texto se ordena sin acentos ni mayúsculas, y los dígitos como números", () => {
    const sorted = sortRows(rows, code, { column: "code", direction: "asc" });
    // EQ-1, EQ-2, EQ-10: el 10 va después del 2, no entre el 1 y el 2.
    expect(sorted.map(code)).toEqual(["EQ-1", "EQ-2", "EQ-10"]);
  });

  test("los números se ordenan como números, en los dos sentidos", () => {
    expect(
      sortRows(rows, stock, { column: "stock", direction: "asc" }).map(stock),
    ).toEqual([1, 3, 10]);
    expect(
      sortRows(rows, stock, { column: "stock", direction: "desc" }).map(stock),
    ).toEqual([10, 3, 1]);
  });

  test("los huecos van al final también al revés", () => {
    const ascending = sortRows(rows, brand, {
      column: "brand",
      direction: "asc",
    });
    const descending = sortRows(rows, brand, {
      column: "brand",
      direction: "desc",
    });
    // La fila sin marca se queda la última en los dos sentidos: la primera fila
    // de la tabla es siempre un dato.
    expect(ascending.map(brand)).toEqual(["Osram", "Rosen", null]);
    expect(descending.map(brand)).toEqual(["Rosen", "Osram", null]);
  });

  test("el cero es un dato, no un hueco", () => {
    const conCero: Row[] = [
      { name: "Uno", code: "A", stock: 0 },
      { name: "Dos", code: "B", stock: 5 },
    ];
    expect(
      sortRows(conCero, stock, { column: "stock", direction: "asc" }).map(
        stock,
      ),
    ).toEqual([0, 5]);
  });

  test("las filas que empatan se quedan como estaban", () => {
    const empate: Row[] = [
      { name: "Primera", code: "Mismo", stock: 1 },
      { name: "Segunda", code: "Mismo", stock: 2 },
      { name: "Tercera", code: "Mismo", stock: 3 },
    ];
    const sorted = sortRows(empate, code, {
      column: "code",
      direction: "desc",
    });
    expect(sorted.map((row) => row.name)).toEqual([
      "Primera",
      "Segunda",
      "Tercera",
    ]);
  });
});

/**
 * El orden que se recuerda entre visitas: qué se guarda, con qué clave y qué se
 * hace con lo guardado cuando ya no sirve —una columna que se renombró, un valor
 * a medias—. La lectura tiene que desconfiar: es la diferencia entre abrir la
 * tabla por donde la dejaste y abrirla ordenada por nada.
 */
describe("recordar el orden de cada tabla", () => {
  /** Un almacenamiento de mentira: como el del navegador, pero en memoria. */
  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  }

  const COLUMNS = ["code", "stock", "brand"] as const;

  test("la clave lleva la tabla y la persona", () => {
    expect(tableSortKey("inventory", "u-1")).toBe(
      "pulso:table-sort:inventory:u-1",
    );
    expect(tableSortKey("equipment", "u-1")).not.toBe(
      tableSortKey("inventory", "u-1"),
    );
    // Sin sesión que valga, se recuerda bajo «anonimo»: mejor eso que no
    // recordar nada.
    expect(tableSortKey("equipment", null)).toBe(
      "pulso:table-sort:equipment:anonimo",
    );
    expect(tableSortKey("equipment", "   ")).toBe(
      "pulso:table-sort:equipment:anonimo",
    );
    expect(tableSortKey("users", " u-2 ")).toBe("pulso:table-sort:users:u-2");
  });

  test("lo guardado se recupera tal cual", () => {
    const storage = memoryStorage();
    const key = tableSortKey("inventory", "u-1");
    writeTableSort(storage, key, { column: "stock", direction: "desc" });
    expect(readTableSort(storage, { key, columns: COLUMNS })).toEqual({
      column: "stock",
      direction: "desc",
    });
  });

  test("sin nada guardado no hay nada que aplicar", () => {
    const storage = memoryStorage();
    expect(
      readTableSort(storage, {
        key: tableSortKey("inventory", "u-1"),
        columns: COLUMNS,
      }),
    ).toBeNull();
    // Y sin almacenamiento —el navegador lo bloquea— tampoco pasa nada.
    expect(readTableSort(null, { key: "x", columns: COLUMNS })).toBeNull();
  });

  test("volver al orden de siempre es olvidarlo", () => {
    const storage = memoryStorage();
    const key = tableSortKey("inventory", "u-1");
    writeTableSort(storage, key, { column: "stock", direction: "desc" });
    writeTableSort(storage, key, null);
    expect(readTableSort(storage, { key, columns: COLUMNS })).toBeNull();
  });

  test("una columna que ya no existe no deja la tabla ordenada por nada", () => {
    const storage = memoryStorage();
    const key = tableSortKey("inventory", "u-1");
    // La columna se llamaba «price» la última vez que se miró esta tabla.
    storage.setItem(key, JSON.stringify({ column: "price", direction: "asc" }));
    expect(readTableSort(storage, { key, columns: COLUMNS })).toBeNull();
  });

  test("lo guardado que no se entiende se descarta", () => {
    const storage = memoryStorage();
    const key = tableSortKey("inventory", "u-1");
    const rotos = [
      "",
      "no es json",
      "[]",
      '"stock"',
      "null",
      '{"column":"stock"}',
      '{"column":"stock","direction":"arriba"}',
      '{"column":7,"direction":"asc"}',
    ];
    for (const raw of rotos) {
      storage.setItem(key, raw);
      expect(readTableSort(storage, { key, columns: COLUMNS })).toBeNull();
    }
  });
});

/**
 * El selector de orden: elige columna de una lista. La lista sale de las
 * columnas de la vista —no de lo que se ve—, que es lo que permite ordenar por
 * las que la tabla esconde en pantallas estrechas.
 */
describe("el selector de orden", () => {
  /** Las columnas de una tabla de mentira; «price» es de las que se esconden. */
  const COLUMNS = {
    code: { label: "Código" },
    stock: { label: "Stock" },
    price: { label: "Precio" },
  } as const;
  type Column = keyof typeof COLUMNS;
  const names = Object.keys(COLUMNS) as Column[];

  test("la opción del orden de siempre no puede confundirse con una columna", () => {
    expect(sortOptionValue(null)).toBe(SORT_OPTION_ORIGINAL);
    expect(sortOptionValue("stock")).not.toBe(SORT_OPTION_ORIGINAL);
    // Aunque una columna se llamase como la opción, siguen siendo distintas.
    expect(sortOptionValue("original")).not.toBe(SORT_OPTION_ORIGINAL);
  });

  test("ofrece el orden de siempre y todas las columnas, también las ocultas", () => {
    // La lista no depende de por dónde vaya la tabla: están todas siempre, y cada
    // una se lee a secas —el sentido lo dicen el aviso y el botón—.
    const options = sortOptions(COLUMNS);
    expect(options.map((option) => option.label)).toEqual([
      "Orden original",
      "Código",
      "Stock",
      "Precio",
    ]);
    expect(options[0].value).toBe(SORT_OPTION_ORIGINAL);
  });

  test("elegir una columna ordena de menor a mayor", () => {
    const chosen = sortFromOptionValue(sortOptionValue("price"), null, names);
    expect(chosen).toEqual({ column: "price", direction: "asc" });
  });

  test("volver a elegir la columna que ya manda no cambia nada", () => {
    // Volver a elegir lo ya elegido no avisa al selector —el valor no ha
    // cambiado—, así que aquí no puede pasar nada: el sentido lo mueve el botón.
    const sorted: TableSort<Column> = { column: "stock", direction: "desc" };
    expect(sortFromOptionValue(sortOptionValue("stock"), sorted, names)).toBe(
      sorted,
    );
  });

  test("cambiar de columna empieza de nuevo, de menor a mayor", () => {
    const sorted: TableSort<Column> = { column: "stock", direction: "desc" };
    expect(
      sortFromOptionValue(sortOptionValue("price"), sorted, names),
    ).toEqual({ column: "price", direction: "asc" });
  });

  test("el botón de invertir da la vuelta al sentido y no toca la columna", () => {
    const ascending: TableSort<Column> = { column: "price", direction: "asc" };
    const descending = flipTableSort(ascending);
    expect(descending).toEqual({ column: "price", direction: "desc" });
    expect(flipTableSort(descending)).toEqual(ascending);
  });

  test("sin columna elegida no hay sentido que invertir", () => {
    expect(flipTableSort(null)).toBeNull();
  });

  test("la opción del orden de siempre devuelve la tabla a como llega", () => {
    expect(
      sortFromOptionValue(
        SORT_OPTION_ORIGINAL,
        {
          column: "price",
          direction: "asc",
        },
        names,
      ),
    ).toBeNull();
  });

  test("una opción de una columna que ya no existe no ordena por nada", () => {
    const sorted: TableSort<Column> = { column: "stock", direction: "asc" };
    expect(sortFromOptionValue(sortOptionValue("brand"), sorted, names)).toBe(
      sorted,
    );
    expect(sortFromOptionValue("cualquier cosa", sorted, names)).toBe(sorted);
  });

  test("el sentido se lee igual en el aviso y en el botón", () => {
    expect(directionLabel("asc")).toBe("de menor a mayor");
    expect(directionLabel("desc")).toBe("de mayor a menor");
  });
});

describe("compareSortValues — el criterio de comparación", () => {
  test("los acentos no separan palabras que van juntas", () => {
    expect(compareSortValues("Ámbar", "arco")).toBeLessThan(0);
    expect(compareSortValues("árbol", "Arbusto")).toBeLessThan(0);
  });

  test("los números sueltos se comparan como números", () => {
    expect(compareSortValues(9, 10)).toBeLessThan(0);
    expect(compareSortValues("9", "10")).toBeLessThan(0);
  });
});
