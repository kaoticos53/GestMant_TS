/**
 * El parte de una incidencia, maquetado en PDF.
 *
 * El informe se compone una sola vez, en Markdown (`lib/report`), porque es el
 * formato que se lee en cualquier editor y el que se descarga. Aquí se toma ese
 * mismo texto y se compone en hojas A4: el PDF y el Markdown cuentan exactamente
 * lo mismo, y el formato de las notas —negritas, cursivas, listas anidadas,
 * citas, separadores, tablas e imágenes— llega al papel sin pasar por HTML.
 */

import { PdfDocument } from "./pdf";
import { ReportBlockRenderer } from "./reportPdf/blockRenderer";
import { PAGE } from "./reportPdf/constants";
import { PdfCursor } from "./reportPdf/cursor";
import {
  helveticaMeasure,
  parseReportInline,
  parseReportMarkdown,
} from "./reportPdf/parser";
import type {
  PdfLoadImage,
  PdfMeasureText,
  ReportBlock,
  ReportPdfOptions,
} from "./reportPdf/types";

export type {
  PdfMeasureText,
  PdfLoadImage,
  ReportBlock,
  ReportPdfOptions,
};

export {
  helveticaMeasure,
  parseReportInline,
  parseReportMarkdown,
};

/**
 * Orquestador del maquetado del parte: coordina el cursor geométrico, el parser
 * de bloques Markdown y el renderizador gráfico en PDF.
 */
export class ReportLayout {
  private readonly doc = new PdfDocument(PAGE);
  private readonly cursor: PdfCursor;
  private readonly renderer: ReportBlockRenderer;

  private readonly footer: string | undefined;

  constructor(
    measure: PdfMeasureText,
    loadImage: PdfLoadImage | undefined,
    footer: string | undefined,
  ) {
    this.footer = footer;
    this.cursor = new PdfCursor(this.doc);
    this.renderer = new ReportBlockRenderer(
      this.cursor,
      this.doc,
      measure,
      loadImage,
    );
  }

  async render(markdown: string): Promise<Uint8Array> {
    for (const block of parseReportMarkdown(markdown)) {
      await this.renderer.renderBlock(block);
    }
    this.renderer.drawFooters(this.footer);
    return this.doc.toBytes();
  }
}

/**
 * El parte en PDF: el mismo Markdown que se descarga, compuesto en hojas A4.
 * Es asíncrono porque las imágenes del parte se traen de donde estén.
 */
export async function reportToPdf(
  markdown: string,
  options: ReportPdfOptions = {},
): Promise<Uint8Array> {
  const layout = new ReportLayout(
    options.measure ?? helveticaMeasure,
    options.loadImage,
    options.footer,
  );
  return await layout.render(markdown);
}
