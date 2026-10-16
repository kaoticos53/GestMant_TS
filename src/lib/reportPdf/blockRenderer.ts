import type { PdfColor, PdfDocument } from "../pdf";
import {
  BODY_LEADING,
  BODY_SIZE,
  CELL_PADDING,
  CONTENT_WIDTH,
  GRAY,
  HEADER_BG,
  HEADING_SIZES,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_SCALE,
  LIGHT,
  LINE_FACTOR,
  LIST_INDENT,
  MARGIN,
  PAGE,
  QUOTE_INDENT,
  TABLE_INDENT,
} from "./constants";
import type { PdfCursor } from "./cursor";
import { boldRuns, parseReportInline, toBold } from "./parser";
import { wrapRuns } from "./textWrapper";
import type { PdfLoadImage, PdfMeasureText, ReportBlock, Run } from "./types";

/** Una fila con tantas celdas como columnas tenga la tabla. */
function normalizeRow(row: readonly string[], columns: number): string[] {
  return Array.from({ length: columns }, (_, column) => row[column] ?? "");
}

/**
 * Renderizador de bloques del parte técnico: ejecuta las operaciones de dibujo
 * sobre el documento y las páginas utilizando el cursor de avance vertical.
 */
export class ReportBlockRenderer {
  private readonly cursor: PdfCursor;
  private readonly doc: PdfDocument;
  private readonly measure: PdfMeasureText;
  private readonly loadImage: PdfLoadImage | undefined;

  constructor(
    cursor: PdfCursor,
    doc: PdfDocument,
    measure: PdfMeasureText,
    loadImage?: PdfLoadImage,
  ) {
    this.cursor = cursor;
    this.doc = doc;
    this.measure = measure;
    this.loadImage = loadImage;
  }

  async renderBlock(block: ReportBlock): Promise<void> {
    switch (block.type) {
      case "heading":
        this.heading(block);
        return;
      case "paragraph":
        this.paragraph(
          parseReportInline(block.text),
          CONTENT_WIDTH,
          MARGIN.left,
          10,
        );
        return;
      case "item":
        this.item(block);
        return;
      case "quote":
        this.quote(block);
        return;
      case "table":
        this.table(block);
        return;
      case "image":
        await this.image(block);
        return;
      case "rule":
        this.rule();
        return;
    }
  }

  /** Una línea de texto: reserva su alto, la pinta y baja el cursor. */
  line(
    line: readonly Run[],
    options: {
      x?: number;
      size?: number;
      leading?: number;
      color?: PdfColor;
    } = {},
  ): void {
    const size = options.size ?? BODY_SIZE;
    const leading = options.leading ?? BODY_LEADING;
    this.cursor.ensure(leading);
    const baseline = this.cursor.baseline(size);
    this.drawRuns(
      line,
      options.x ?? MARGIN.left,
      baseline,
      size,
      options.color,
    );
    this.cursor.advance(leading);
  }

  /** Los trozos de una línea, uno detrás de otro, con sus rayas. */
  drawRuns(
    runs: readonly Run[],
    x: number,
    baseline: number,
    size: number,
    color?: PdfColor,
  ): void {
    let currentX = x;
    const page = this.cursor.page;
    for (const run of runs) {
      const width = this.measure(run.text, run.font, size);
      page.text(run.text, currentX, baseline, {
        font: run.font,
        size,
        color: run.color ?? color,
      });
      if (run.strike) {
        page.line(
          currentX,
          baseline - size * 0.28,
          currentX + width,
          baseline - size * 0.28,
          {
            color: run.color ?? color ?? GRAY,
          },
        );
      }
      if (run.link) {
        page.line(currentX, baseline + 1.8, currentX + width, baseline + 1.8, {
          color: run.color ?? color ?? GRAY,
          width: 0.5,
        });
      }
      currentX += width;
    }
  }

  private heading(block: { level: number; text: string }): void {
    const size = HEADING_SIZES[block.level] ?? BODY_SIZE + 0.5;
    const leading = size * LINE_FACTOR;
    const lines = wrapRuns(
      toBold(parseReportInline(block.text)),
      CONTENT_WIDTH,
      size,
      this.measure,
    );
    const gap = block.level === 1 ? 0 : size * 1.1;
    // Un título no se queda solo al final de la hoja: se lleva consigo las
    // primeras líneas de lo que anuncia.
    this.cursor.ensure(gap + lines.length * leading + BODY_LEADING * 2);
    this.cursor.advance(gap);
    for (const l of lines) this.line(l, { size, leading });
    this.cursor.advance(size * 0.5);
  }

  paragraph(
    runs: readonly Run[],
    width: number,
    x: number,
    gap: number,
    size: number = BODY_SIZE,
  ): void {
    const lines = wrapRuns(runs, width, size, this.measure);
    this.cursor.advance(gap);
    for (const l of lines) this.line(l, { x, size });
  }

  private item(block: { marker: string; text: string; depth: number }): void {
    const indent = MARGIN.left + block.depth * LIST_INDENT;
    const markerWidth = this.measure(block.marker, "regular", BODY_SIZE) + 6;
    const textX = indent + markerWidth;
    const width = CONTENT_WIDTH - (textX - MARGIN.left);
    const lines = wrapRuns(
      parseReportInline(block.text),
      width,
      BODY_SIZE,
      this.measure,
    );
    this.cursor.advance(block.depth === 0 ? 4 : 3);

    lines.forEach((l, index) => {
      this.cursor.ensure(BODY_LEADING);
      const baseline = this.cursor.baseline(BODY_SIZE);
      if (index === 0) {
        this.drawRuns(
          parseReportInline(block.marker),
          indent,
          baseline,
          BODY_SIZE,
          GRAY,
        );
      }
      this.drawRuns(l, textX, baseline, BODY_SIZE);
      this.cursor.advance(BODY_LEADING);
    });
  }

  private quote(block: { text: string }): void {
    const x = MARGIN.left + QUOTE_INDENT;
    const width = CONTENT_WIDTH - QUOTE_INDENT;
    const lines = wrapRuns(
      parseReportInline(block.text),
      width,
      BODY_SIZE,
      this.measure,
    );
    this.cursor.advance(8);
    for (const l of lines) {
      this.cursor.ensure(BODY_LEADING);
      const baseline = this.cursor.baseline(BODY_SIZE);
      this.drawRuns(l, x, baseline, BODY_SIZE);
      this.cursor.page.line(
        MARGIN.left + 4,
        baseline - BODY_SIZE,
        MARGIN.left + 4,
        baseline + BODY_SIZE * 0.3,
        { color: LIGHT, width: 2 },
      );
      this.cursor.advance(BODY_LEADING);
    }
    this.cursor.advance(4);
  }

  private rule(): void {
    this.cursor.advance(12);
    this.cursor.ensure(1);
    this.cursor.page.line(
      MARGIN.left,
      this.cursor.y,
      PAGE.width - MARGIN.right,
      this.cursor.y,
      {
        color: LIGHT,
        width: 0.8,
      },
    );
    this.cursor.advance(12);
  }

  private async image(block: { src: string; alt: string }): Promise<void> {
    const img = this.loadImage ? await this.loadImage(block.src) : null;
    if (!img) {
      this.paragraph(
        parseReportInline(
          `_${block.alt ? `[imagen no disponible: ${block.alt}]` : "[imagen no disponible]"}_`,
        ),
        CONTENT_WIDTH,
        MARGIN.left,
        10,
      );
      return;
    }
    const scale = Math.min(
      CONTENT_WIDTH / img.width,
      IMAGE_MAX_HEIGHT / img.height,
      IMAGE_MAX_SCALE,
    );
    const width = img.width * scale;
    const height = img.height * scale;
    const x = MARGIN.left + (CONTENT_WIDTH - width) / 2;
    this.cursor.advance(10);
    this.cursor.ensure(height);
    this.cursor.page.drawImage(
      this.doc.addImage(img),
      x,
      this.cursor.y,
      width,
      height,
    );
    this.cursor.advance(height + 10);
  }

  private table(block: { header: string[]; rows: string[][] }): void {
    const columns = Math.max(
      block.header.length,
      ...block.rows.map((row) => row.length),
      1,
    );
    const header = normalizeRow(block.header, columns);
    const rows = block.rows.map((row) => normalizeRow(row, columns));

    this.cursor.advance(TABLE_INDENT);
    const natural = Array.from({ length: columns }, (_, column) => {
      const texts = [header[column], ...rows.map((row) => row[column])];
      return Math.max(
        ...texts.map(
          (text) => this.measure(text, "regular", BODY_SIZE) + CELL_PADDING * 2,
        ),
      );
    });
    const total = natural.reduce((sum, width) => sum + width, 0);
    const widths = natural.map((width) => (width * CONTENT_WIDTH) / total);

    const rowLayout = (cells: readonly string[], bold: boolean) =>
      cells.map((cell, column) => {
        const runs = bold ? boldRuns(cell) : parseReportInline(cell);
        return wrapRuns(
          runs,
          widths[column] - CELL_PADDING * 2,
          BODY_SIZE,
          this.measure,
        );
      });

    const drawRow = (cells: readonly string[], bold: boolean): void => {
      const lines = rowLayout(cells, bold);
      const height =
        Math.max(...lines.map((cell) => cell.length)) * BODY_LEADING +
        CELL_PADDING * 2;
      this.cursor.ensure(height);
      const top = this.cursor.y;
      if (bold) {
        this.cursor.page.rect(MARGIN.left, top, CONTENT_WIDTH, height, {
          color: HEADER_BG,
        });
      }
      let x = MARGIN.left;
      lines.forEach((cell, column) => {
        cell.forEach((l, index) => {
          this.drawRuns(
            l,
            x + CELL_PADDING,
            top + CELL_PADDING + BODY_SIZE * 1.06 + index * BODY_LEADING,
            BODY_SIZE,
          );
        });
        x += widths[column];
      });
      this.cursor.y = top + height;
      this.cursor.page.line(
        MARGIN.left,
        this.cursor.y,
        MARGIN.left + CONTENT_WIDTH,
        this.cursor.y,
        {
          color: LIGHT,
        },
      );
    };

    drawRow(header, true);
    for (const row of rows) {
      const pageBefore = this.cursor.page;
      drawRow(row, false);
      if (this.cursor.page !== pageBefore) drawRow(header, true);
    }
    this.cursor.advance(TABLE_INDENT);
  }

  drawFooters(footerText?: string): void {
    const total = this.doc.pageCount;
    this.doc.pages.forEach((page, index) => {
      const baseline = PAGE.height - MARGIN.bottom + 28;
      page.line(
        MARGIN.left,
        baseline - 14,
        PAGE.width - MARGIN.right,
        baseline - 14,
        {
          color: LIGHT,
        },
      );
      if (footerText) {
        page.text(footerText, MARGIN.left, baseline, {
          size: 8,
          color: GRAY,
        });
      }
      const label = `Página ${index + 1} de ${total}`;
      const width = this.measure(label, "regular", 8);
      page.text(label, PAGE.width - MARGIN.right - width, baseline, {
        size: 8,
        color: GRAY,
      });
    });
  }
}
