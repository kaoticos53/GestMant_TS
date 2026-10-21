/**
 * Las fotos se recomprimen en el navegador antes de subirlas. Una foto de móvil
 * —doce megapíxeles y varios megas— no necesita viajar entera para verse en una
 * ficha: se reescala a lo que de verdad se mira y se queda en unos cientos de
 * kB, así que cabe en el tope de subida sin acercarse a él. Y el trabajo se hace
 * aquí, en el navegador, no después: lo que sale de aquí es lo que se manda al
 * almacén, así que no se gasta la subida de nadie.
 *
 * No todo se toca. Un PDF no se comprime, y una foto que ya viene ligera se sube
 * tal cual: recomprimirla no la mejora, solo le quita calidad. Los GIF quedan
 * fuera a propósito —uno animado perdería el movimiento al pasar por el lienzo—
 * y un SVG no es una foto, es un documento. Si el navegador no sabe leer el
 * archivo (un HEIC que no entiende, por ejemplo), se sube el original y el
 * camino sigue como estaba.
 */

/** Lado mayor al que se reduce una foto: más grande no se ve mejor en una ficha. */
export const MAX_IMAGE_SIDE = 2000;

/**
 * Calidad del JPEG resultante: el punto en el que el recorte ya no se nota al
 * mirarlo, que es lo que se hace con la foto de una avería.
 */
export const IMAGE_QUALITY = 0.82;

/**
 * Por debajo de esto la foto ya viene ligera y se sube tal cual: recomprimirla
 * no la acerca a ningún tope que no estuviera ya lejos.
 */
export const MIN_COMPRESS_BYTES = 1024 * 1024;

/**
 * Lo que el navegador sabe recomprimir: fotos de verdad, no animaciones ni
 * dibujos vectoriales.
 */
const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

/** Una foto ya descodificada, con el tamaño con el que se puede trabajar. */
type DecodedPhoto = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

/**
 * El tamaño que le toca a una foto al reducirla: la proporción se mantiene y
 * nunca se amplía —una foto pequeña no mejora por hacerse grande—.
 */
export function fittedImageSize(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const widest = Math.max(width, height);
  if (!Number.isFinite(widest) || widest <= 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  if (widest <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxSide / widest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** ¿Es una foto de las que se pueden recomprimir? Se mira el tipo declarado. */
export function isCompressibleImage(file: { type: string }): boolean {
  return COMPRESSIBLE_TYPES.has(file.type.toLowerCase());
}

/**
 * ¿Merece la pena recomprimirla? Solo las fotos: los documentos no se tocan y
 * una foto ligera se sube como está.
 */
export function shouldCompressImage(file: {
  type: string;
  size: number;
}): boolean {
  return isCompressibleImage(file) && file.size > MIN_COMPRESS_BYTES;
}

/**
 * Con qué tipo se guarda la foto comprimida. Un PNG se queda en PNG —es el
 * único que lleva transparencia y pasarlo a JPEG le pondría el fondo blanco—;
 * el resto va a JPEG, que es lo que espera cualquier visor.
 */
export function compressedImageType(sourceType: string): string {
  return sourceType.toLowerCase() === "image/png" ? "image/png" : "image/jpeg";
}

/**
 * El nombre del archivo comprimido: el mismo, con la extensión que le toca
 * (una foto de iPhone llega como `IMG_1234.HEIC` y se guarda como JPEG).
 */
export function compressedImageName(name: string, type: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  const extension = type === "image/png" ? "png" : "jpg";
  return `${base || "foto"}.${extension}`;
}

/**
 * Intenta delegar la compresión pesada a un Web Worker en un hilo secundario
 * para no congelar la interfaz de usuario. Si el entorno no soporta Workers u
 * OffscreenCanvas, o si se produce un timeout, devuelve null para usar el fallback.
 */
async function compressWithWorker(file: File): Promise<File | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return null;
  }
  return new Promise<File | null>((resolve) => {
    let worker: Worker | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (worker) {
        worker.terminate();
        worker = null;
      }
    };

    try {
      worker = new Worker(
        new URL("../workers/compress.worker.ts", import.meta.url),
        { type: "module" },
      );

      timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 5000);

      worker.onmessage = (e: MessageEvent<{ success: boolean; file?: File }>) => {
        const result = e.data;
        cleanup();
        if (result && result.success && result.file) {
          resolve(result.file);
        } else {
          resolve(null);
        }
      };

      worker.onerror = () => {
        cleanup();
        resolve(null);
      };

      worker.postMessage({
        id: Math.random().toString(36).substring(2),
        file,
        maxSide: MAX_IMAGE_SIDE,
        quality: IMAGE_QUALITY,
      });
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

/** El archivo comprimido, o el original si no sale a cuenta subirlo recomprimido. */
export async function compressImageFile(file: File): Promise<File> {
  if (!shouldCompressImage(file)) return file;
  try {
    const fromWorker = await compressWithWorker(file);
    if (fromWorker) return fromWorker;

    return (await recompressImage(file)) ?? file;
  } catch {
    // Que este navegador no sepa leer o codificar esa foto no puede impedir que
    // se suba: se manda el original, como antes de que existiera esto.
    return file;
  }
}

/**
 * La foto pasada por el lienzo, o `null` si no se puede leer, si no hay lienzo
 * donde pintarla o si el resultado no mejora al original.
 */
async function recompressImage(file: File): Promise<File | null> {
  const photo = await decodeImage(file);
  if (!photo) return null;

  const { width, height } = fittedImageSize(photo.width, photo.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const type = compressedImageType(file.type);
  if (type === "image/jpeg") {
    // Un JPEG no tiene transparencia: el fondo se pinta antes para que una zona
    // transparente no salga negra al pasar por el lienzo.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(photo.source, 0, 0, width, height);

  const blob = await toBlob(canvas, type);
  // Recomprimir nunca debería engordar un archivo: si ha salido más grande que
  // el original, se sube el original.
  if (!blob || blob.size >= file.size) return null;

  return new File([blob], compressedImageName(file.name, type), {
    type,
    lastModified: file.lastModified,
  });
}

/** La foto descodificada, con su orientación ya corregida; `null` si no se puede leer. */
async function decodeImage(file: File): Promise<DecodedPhoto | null> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` respeta la orientación EXIF, así que la foto de un móvil no
      // sale tumbada por el camino.
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Este navegador no sabe leer este formato por aquí: se prueba por el <img>.
    }
  }

  return await new Promise<DecodedPhoto | null>((resolve) => {
    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      resolve(null);
      return;
    }
    const image = new Image();
    const finish = (photo: DecodedPhoto | null) => {
      URL.revokeObjectURL(url);
      resolve(photo);
    };
    image.onload = () =>
      finish({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => finish(null);
    image.src = url;
  });
}

/** El lienzo como archivo. `null` si el navegador no sabe codificarlo. */
function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, IMAGE_QUALITY);
    } catch {
      resolve(null);
    }
  });
}
