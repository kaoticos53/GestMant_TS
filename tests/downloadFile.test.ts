/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFileName, downloadFileFromUrl } from "@/lib/downloadFile";

function stubDownload() {
  let captured: Blob | null = null;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(["contenido"], { type: "message/rfc822" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    captured = value as Blob;
    return "blob:pulso";
  });
  const revoke = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const append = vi.spyOn(document.body, "append");
  return { fetchMock, append, revoke, blob: () => captured };
}

describe("downloadFileName", () => {
  it("sustituye lo que el sistema de archivos no admite", () => {
    expect(downloadFileName("Informe: revisión/2026.pdf")).toBe(
      "Informe_ revisión_2026.pdf",
    );
    expect(downloadFileName('copia "final"?.eml')).toBe("copia _final__.eml");
  });

  it("nunca deja un nombre vacío ni acabado en punto", () => {
    expect(downloadFileName("   ")).toBe("descarga");
    expect(downloadFileName("copia.")).toBe("copia");
    expect(downloadFileName("...")).toBe("descarga");
  });

  it("recorta nombres desmesurados", () => {
    expect(downloadFileName("a".repeat(400)).length).toBe(180);
  });
});

describe("downloadFileFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("descarga el contenido como blob con el nombre indicado", async () => {
    vi.useFakeTimers();
    const spy = stubDownload();

    await downloadFileFromUrl(
      "http://127.0.0.1:3210/api/storage/uno",
      "copia.eml",
    );

    expect(spy.fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/api/storage/uno",
    );
    const anchor = spy.append.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.href).toBe("blob:pulso");
    expect(anchor.download).toBe("copia.eml");
    // El archivo se abre aparte si el navegador desobedece `download`.
    expect(anchor.target).toBe("_blank");
  });

  it("entrega el archivo como binario para que el navegador lo guarde", async () => {
    const spy = stubDownload();

    await downloadFileFromUrl(
      "http://127.0.0.1:3210/api/storage/uno",
      "copia.eml",
    );

    const blob = spy.blob();
    expect(blob?.type).toBe("application/octet-stream");
    expect(blob?.size).toBe(new Blob(["contenido"]).size);
  });

  it("limpia el nombre antes de entregarlo al navegador", async () => {
    const spy = stubDownload();

    await downloadFileFromUrl(
      "http://127.0.0.1:3210/api/storage/uno",
      "Informe: revisión/2026.pdf",
    );

    const anchor = spy.append.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("Informe_ revisión_2026.pdf");
  });

  it("libera el objeto cuando el gestor ya lo ha leído, no en el acto", async () => {
    vi.useFakeTimers();
    const spy = stubDownload();

    await downloadFileFromUrl(
      "http://127.0.0.1:3210/api/storage/uno",
      "copia.eml",
    );
    expect(spy.revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(spy.revoke).toHaveBeenCalledWith("blob:pulso");
  });

  it("falla si el almacén no entrega el archivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    await expect(
      downloadFileFromUrl("http://127.0.0.1:3210/api/storage/uno", "copia.eml"),
    ).rejects.toThrow("No se pudo descargar el archivo (404).");
  });
});
