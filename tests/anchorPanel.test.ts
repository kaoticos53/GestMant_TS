import { describe, expect, test } from "vitest";
import { anchoredPanelStyle } from "../src/lib/anchorPanel";

/**
 * El anclaje de un desplegable a la ventana, que comparten la campana de avisos
 * y el icono de mensajes. Lo que se comprueba aquí son los números: de dónde
 * sale la posición (de medir el botón, no de su contenedor) y cómo se acota para
 * que el panel no se salga de la ventana —se encoge de ancho, se recorta de alto
 * cuando el botón está abajo del todo y se desplaza cuando alineado con el botón
 * se saldría por la izquierda—.
 */

/** Un botón de una cabecera de 900 × 700, con su borde derecho a 700 px. */
const BOTON = { bottom: 100, right: 700 };
const VENTANA = { width: 900, height: 700 };

describe("anclaje de un desplegable a la ventana", () => {
  test("va en fixed, pegado al botón por abajo y alineado con su borde derecho", () => {
    expect(anchoredPanelStyle(BOTON, VENTANA)).toEqual({
      position: "fixed",
      top: 108, // el borde inferior del botón (100) más la separación (8)
      left: 380, // 700 − 320: el panel acaba donde el botón
      width: 320, // el ancho pedido, que cabe de sobra
      maxHeight: 384, // el tope de siempre; el hueco de abajo es mayor
    });
  });

  test("pegado al borde derecho, se desplaza el margen en vez de salirse", () => {
    const pegado = anchoredPanelStyle({ bottom: 40, right: 900 }, VENTANA);

    // Alineado con el botón acabaría en 580 y se saldría 8 px: se queda en 572.
    expect(pegado.left).toBe(572);
    expect(pegado.left + pegado.width).toBe(VENTANA.width - 8);
    expect(pegado.top).toBe(48);
  });

  test("con el botón en el centro de una ventana estrecha, no se sale por la izquierda", () => {
    // Un icono a 236 px del borde izquierdo en un móvil de 390: alineado con él,
    // el panel empezaría en −84.
    const movil = anchoredPanelStyle(
      { bottom: 50, right: 236 },
      {
        width: 390,
        height: 844,
      },
    );

    expect(movil.left).toBe(8); // el margen, nunca menos
    expect(movil.left + movil.width).toBeLessThanOrEqual(390 - 8);
  });

  test("en una ventana estrecha se encoge de ancho antes que quedarse fuera", () => {
    // 300 − 16 de margen: lo que la ventana da, menos el ancho pedido.
    const estrecha = anchoredPanelStyle(BOTON, { width: 300, height: 700 });
    expect(estrecha.width).toBe(284);
    expect(estrecha.left).toBe(8);

    // Y no baja del mínimo legible: más estrecho no se lee.
    expect(anchoredPanelStyle(BOTON, { width: 200, height: 700 }).width).toBe(
      240,
    );
  });

  test("con el botón abajo del todo se recorta de alto, no se sale por abajo", () => {
    const abajo = anchoredPanelStyle({ bottom: 650, right: 100 }, VENTANA);

    // 700 − (650 + 8 de separación) − 8 de margen.
    expect(abajo.maxHeight).toBe(34);
    // El ancho sigue siendo el que pide: recortar de alto no lo cambia.
    expect(abajo.width).toBe(320);
  });

  test("sin medida del botón se abre en la esquina, no escondido en (0,0)", () => {
    const sinMedida = anchoredPanelStyle(null, VENTANA);

    expect(sinMedida.position).toBe("fixed");
    expect(sinMedida.top).toBe(8);
    // Pegado al borde derecho de la ventana: es lo que más se parece a un botón
    // de una cabecera.
    expect(sinMedida.left).toBe(900 - 8 - sinMedida.width);
    expect(sinMedida.width).toBe(320);
  });

  test("lo que se puede ajustar: separación, margen, ancho y alto", () => {
    const ajustado = anchoredPanelStyle(BOTON, VENTANA, {
      gap: 4,
      margin: 24,
      width: 240,
      minWidth: 200,
      maxHeight: 500,
    });

    expect(ajustado).toEqual({
      position: "fixed",
      top: 104,
      left: 460, // 700 − 240
      width: 240,
      maxHeight: 500,
    });
  });
});
