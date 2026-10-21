export interface CompressWorkerRequest {
  id: string;
  file: File;
  maxSide?: number;
  quality?: number;
}

export interface CompressWorkerResponse {
  id: string;
  success: boolean;
  file?: File;
  error?: string;
}

// Escuchar peticiones en el contexto del Web Worker
self.onmessage = async (e: MessageEvent<CompressWorkerRequest>) => {
  const { id, file, maxSide = 2000, quality = 0.82 } = e.data;

  try {
    if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
      self.postMessage({
        id,
        success: false,
        error: "OffscreenCanvas o createImageBitmap no están disponibles en este entorno",
      } satisfies CompressWorkerResponse);
      return;
    }

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const widest = Math.max(bitmap.width, bitmap.height);
    let targetW = bitmap.width;
    let targetH = bitmap.height;

    if (widest > maxSide && Number.isFinite(widest) && widest > 0) {
      const scale = maxSide / widest;
      targetW = Math.max(1, Math.round(bitmap.width * scale));
      targetH = Math.max(1, Math.round(bitmap.height * scale));
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      self.postMessage({
        id,
        success: false,
        error: "No se pudo obtener el contexto 2d de OffscreenCanvas",
      } satisfies CompressWorkerResponse);
      return;
    }

    const isPng = file.type.toLowerCase() === "image/png";
    const type = isPng ? "image/png" : "image/jpeg";

    if (!isPng) {
      // Fondo blanco para JPEG si había transparencias
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob = await canvas.convertToBlob({ type, quality });

    // Si no comprime o engorda el archivo, se devuelve el original
    if (!blob || blob.size >= file.size) {
      self.postMessage({
        id,
        success: true,
        file,
      } satisfies CompressWorkerResponse);
      return;
    }

    const ext = isPng ? "png" : "jpg";
    const base = file.name.replace(/\.[^./\\]+$/, "");
    const compressedFile = new File([blob], `${base || "foto"}.${ext}`, {
      type,
      lastModified: file.lastModified,
    });

    self.postMessage({
      id,
      success: true,
      file: compressedFile,
    } satisfies CompressWorkerResponse);
  } catch (err: unknown) {
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies CompressWorkerResponse);
  }
};
