/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFileFromUrl } from "@/lib/downloadFile";

describe("downloadFileFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("descarga el contenido como blob con el nombre indicado", async () => {
    vi.useFakeTimers();
    const blob = new Blob(["contenido"], { type: "text/plain" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pulso");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const append = vi.spyOn(document.body, "append");

    await downloadFileFromUrl(
      "http://127.0.0.1:3210/api/storage/uno",
      "copia.eml",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/api/storage/uno",
    );
    const anchor = append.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.href).toBe("blob:pulso");
    expect(anchor.download).toBe("copia.eml");
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:pulso");
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
