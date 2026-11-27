import { describe, expect, test } from "vitest";
import {
  PDF_PREVIEW_MAX_BYTES,
  looksLikePdf,
  pdfPreviewProblem,
  pdfPreviewProblemMessage,
} from "../src/lib/pdfPreview";

const encode = (text: string) => new TextEncoder().encode(text);

describe("visor de PDF · validación del archivo", () => {
  test("reconoce la firma %PDF- al principio o tras basura inicial", () => {
    expect(looksLikePdf(encode("%PDF-1.7\n%âãÏÓ"))).toBe(true);
    expect(looksLikePdf(encode("\uFEFF   %PDF-1.4"))).toBe(true);
  });

  test("rechaza contenido que no es PDF", () => {
    expect(looksLikePdf(encode("<!doctype html><html>"))).toBe(false);
    expect(looksLikePdf(encode("%PD"))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });

  test("pdfPreviewProblem decide si se puede previsualizar", () => {
    const pdf = encode("%PDF-1.7");
    expect(pdfPreviewProblem(2048, pdf)).toBeNull();
    expect(pdfPreviewProblem(0, pdf)).toBe("empty");
    expect(pdfPreviewProblem(PDF_PREVIEW_MAX_BYTES + 1, pdf)).toBe("too_large");
    expect(pdfPreviewProblem(2048, encode("<html>"))).toBe("not_pdf");
  });

  test("cada problema tiene un mensaje para el técnico", () => {
    expect(pdfPreviewProblemMessage("too_large")).toContain("Descárgalo");
    expect(pdfPreviewProblemMessage("not_pdf")).toContain("no es un PDF");
    expect(pdfPreviewProblemMessage("empty")).toContain("vacío");
  });
});
