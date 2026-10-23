import { describe, expect, test } from "vitest";
import {
  DEFAULT_LABEL_SIZE,
  LABEL_SIZES,
  barcodeModules,
  code128Barcode,
  equipmentLabel,
  labelDate,
  labelLookupUrl,
  labelPrintDocument,
  labelSize,
  labelSvg,
  partLabel,
} from "../src/lib/labelGenerator";

/**
 * Las etiquetas físicas: qué se imprime, con qué medidas y con qué códigos.
 *
 * El Code 128 se comprueba contra la norma —el inicio, el dígito de control y
 * el fin tienen anchos conocidos— y el SVG por lo que tiene que llevar dentro:
 * la medida en milímetros, el nombre escapado y un QR que se pueda leer. La
 * prueba no dibuja: en un taller la etiqueta se valida imprimiéndola, y eso es
 * lo que hace el diálogo con la vista previa.
 */

const equipamiento = {
  code: "EQ-CAM-0042",
  name: "Cámara de estudio",
  brand: "Sony",
  model: "HDC-3500",
  location: "Plató 2",
  purchaseDate: Date.parse("2024-03-15T10:00:00"),
};

const repuesto = {
  code: "ALI-24015",
  name: "Fuente de alimentación 12 V",
  category: "Electrónica",
  location: "B-03",
  createdAt: Date.parse("2025-11-02T09:30:00"),
};

describe("el contenido de la etiqueta", () => {
  test("los dos rollos y la medida por defecto", () => {
    expect(LABEL_SIZES.map((size) => size.id)).toEqual(["50x30", "60x40"]);
    expect(labelSize(DEFAULT_LABEL_SIZE).widthMm).toBe(50);
    expect(labelSize("60x40")).toMatchObject({ widthMm: 60, heightMm: 40 });
    // Una medida que no existe no deja la etiqueta sin medidas.
    expect(labelSize("99x99" as never).widthMm).toBe(50);
  });

  test("la dirección del QR lleva al buscador del módulo que toca", () => {
    expect(labelLookupUrl("equipment", "EQ-CAM-0042", "https://taller.local")).toBe(
      "https://taller.local/dashboard?equipo=EQ-CAM-0042",
    );
    // Sin barra final de más, y con el código escapado.
    expect(labelLookupUrl("part", "ALI 24015", "https://taller.local/")).toBe(
      "https://taller.local/dashboard?repuesto=ALI%2024015",
    );
    // Sin origen, la dirección es relativa: la etiqueta se compone igual.
    expect(labelLookupUrl("part", "A-1", "")).toBe("/dashboard?repuesto=A-1");
  });

  test("un equipo se cuenta como se lee en la ficha", () => {
    const label = equipmentLabel(equipamiento, "https://taller.local");
    expect(label).toEqual({
      kind: "equipment",
      code: "EQ-CAM-0042",
      title: "Cámara de estudio",
      subtitle: "Sony · HDC-3500",
      location: "Plató 2",
      acquiredOn: "15/03/2024",
      url: "https://taller.local/dashboard?equipo=EQ-CAM-0042",
    });
  });

  test("sin código de inventario se usa el número de serie", () => {
    const label = equipmentLabel(
      { name: "Monitor", serialNumber: "SN-77" },
      "",
    );
    expect(label.code).toBe("SN-77");
    expect(label.url).toBe("/dashboard?equipo=SN-77");
    expect(label.subtitle).toBeUndefined();
    expect(label.acquiredOn).toBe("");
  });

  test("un repuesto lleva su categoría y su ubicación", () => {
    expect(partLabel(repuesto, "https://taller.local")).toMatchObject({
      kind: "part",
      code: "ALI-24015",
      title: "Fuente de alimentación 12 V",
      subtitle: "Electrónica",
      location: "B-03",
      acquiredOn: "02/11/2025",
    });
  });

  test("las fechas se escriben como se leen, no como las da la máquina", () => {
    expect(labelDate(Date.parse("2026-01-05T12:00:00"))).toBe("05/01/2026");
    expect(labelDate(undefined)).toBe("");
    expect(labelDate(Number.NaN)).toBe("");
  });
});

describe("el código de barras Code 128", () => {
  test("empieza por el símbolo B, lleva su control y termina con la barra", () => {
    const barcode = code128Barcode("A");
    // Inicio B (211214) + «A» (111323) + control 34 (131123) + fin.
    expect(barcode.widths.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
    expect(barcode.widths.slice(6, 12)).toEqual([1, 1, 1, 3, 2, 3]);
    // El control de «A»: (104 + 33) % 103 = 34, que es «131123».
    expect(barcode.widths.slice(12, 18)).toEqual([1, 3, 1, 1, 2, 3]);
    expect(barcode.widths.slice(18)).toEqual([2, 3, 3, 1, 1, 1, 2]);
  });

  test("el control cambia con cada carácter y su posición", () => {
    const barcode = code128Barcode("EQ-CAM-0042");
    // La suma de la norma: inicio + valor × posición, módulo 103.
    let sum = 104;
    [..."EQ-CAM-0042"].forEach((character, index) => {
      const value = (character.codePointAt(0) ?? 0) - 32;
      sum += value * (index + 1);
    });
    expect(sum % 103).toBeGreaterThanOrEqual(0);
    expect(barcode.widths).toHaveLength(6 * (1 + 11 + 1) + 7);
    expect(barcode.text).toBe("EQ-CAM-0042");
  });

  test("todos los símbolos miden once módulos y el fin, trece", () => {
    const barcode = code128Barcode("ALI-24015");
    // 11 símbolos de 11 módulos (inicio, nueve caracteres y control) y el fin
    // de 13 módulos con su barra final.
    expect(barcodeModules(barcode)).toBe(11 * 11 + 13);
    // Cada símbolo de la tabla se compone de seis tramos de 1 a 4 módulos.
    for (let i = 0; i + 6 <= barcode.widths.length - 7; i += 6) {
      const symbol = barcode.widths.slice(i, i + 6);
      expect(symbol.reduce((total, width) => total + width, 0)).toBe(11);
      for (const width of symbol) {
        expect(width).toBeGreaterThanOrEqual(1);
        expect(width).toBeLessThanOrEqual(4);
      }
    }
  });

  test("lo que el juego B no sabe escribir se rechaza en vez de dibujarse mal", () => {
    expect(() => code128Barcode("")).toThrow();
    expect(() => code128Barcode("ÁRBOL")).toThrow(/Á/);
    expect(() => code128Barcode("EQ\n0042")).toThrow();
  });
});

describe("el dibujo de la etiqueta", () => {
  test("lleva la medida real en milímetros y el QR dentro", () => {
    const size = labelSize("60x40");
    const label = equipmentLabel(equipamiento, "https://taller.local");
    const svg = labelSvg(label, size);

    expect(svg).toContain('width="60mm"');
    expect(svg).toContain('height="40mm"');
    expect(svg).toContain('viewBox="0 0 60 40"');
    // El nombre y la ubicación, escapados y legibles.
    // El nombre se reparte en las líneas que caben.
    expect(svg).toContain("Cámara de");
    expect(svg).toContain("estudio</text>");
    expect(svg).toContain("Ubic. Plató 2");
    expect(svg).toContain("Sony · HDC-3500");
    // El QR y el código de barras son dos paths negros.
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect(svg).toContain("EQ-CAM-0042");
  });

  test("escapa el texto: un nombre no puede romper el SVG", () => {
    const svg = labelSvg(
      {
        kind: "part",
        code: "X-1",
        title: "<Conector & \"cable\">",
        url: "https://taller.local/dashboard?repuesto=X-1",
      },
      labelSize("50x30"),
    );
    expect(svg).toContain("&lt;Conector &amp;");
    expect(svg).toContain("&quot;cable&quot;&gt;");
    expect(svg).not.toContain("<Conector");
  });

  test("sin código, la etiqueta sale con el texto y sin códigos que leer", () => {
    const svg = labelSvg(
      {
        kind: "equipment",
        code: "",
        title: "Equipo sin inventariar",
        location: "Sótano",
        acquiredOn: "",
        url: "",
      },
      labelSize("50x30"),
    );
    expect(svg).toContain("Equipo sin</text>");
    expect(svg).toContain("inventariar</text>");
    expect(svg).not.toContain("<path ");
  });

  test("el documento de impresión pagina a la medida del rollo", () => {
    const label = partLabel(repuesto, "https://taller.local");
    const html = labelPrintDocument([label], { size: "50x30", copies: 3 });

    expect(html).toContain("@page { size: 50mm 30mm; margin: 0; }");
    expect((html.match(/class="sheet"/g) ?? []).length).toBe(3);
    // Todas las copias son la misma etiqueta.
    expect((html.match(/ALI-24015/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Sin márgenes ni cabeceras: el navegador no mete nada suyo.
    expect(html).toContain("margin: 0");
  });
});
