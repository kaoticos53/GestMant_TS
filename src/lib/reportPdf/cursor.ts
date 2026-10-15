import type { PdfDocument, PdfPage } from "../pdf";
import { CONTENT_WIDTH, MARGIN, PAGE } from "./constants";

/**
 * Control del cursor geométrico vertical en el PDF: maneja el avance en 'y',
 * el cálculo de líneas base y el salto automático a una nueva hoja cuando el
 * contenido supera el límite inferior de la página.
 */
export class PdfCursor {
  private _page: PdfPage;
  private _y: number = MARGIN.top;

  constructor(private readonly doc: PdfDocument) {
    this._page = this.doc.addPage();
  }

  get page(): PdfPage {
    return this._page;
  }

  get y(): number {
    return this._y;
  }

  set y(value: number) {
    this._y = value;
  }

  get bottom(): number {
    return PAGE.height - MARGIN.bottom;
  }

  get left(): number {
    return MARGIN.left;
  }

  get contentWidth(): number {
    return CONTENT_WIDTH;
  }

  /**
   * Si lo que va a escribirse no cabe en la hoja actual, abre una nueva hoja y
   * reinicia la posición vertical en el margen superior.
   */
  ensure(space: number): void {
    if (this._y + space <= this.bottom) return;
    this._page = this.doc.addPage();
    this._y = MARGIN.top;
  }

  /** Avanza verticalmente el cursor en el papel. */
  advance(amount: number): void {
    this._y += amount;
  }

  /**
   * Calcula la línea base tipográfica a partir de la posición 'y' actual y el
   * tamaño de letra.
   */
  baseline(size: number): number {
    return this._y + size * 1.06;
  }
}
