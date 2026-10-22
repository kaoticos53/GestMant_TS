/**
 * Tipos e interfaces para el módulo de imágenes y vales sin usar del formulario público.
 */

export interface UnusedImageItem {
  id: string;
  url: string | null;
  size: number;
  uploadedAt: number;
}

export interface UnusedPendingData {
  images: UnusedImageItem[];
  tickets: number;
  unreadable: number;
  totalBytes: number;
  partial?: boolean;
}

export interface PurgeResult {
  images: number;
  tickets: number;
  bytes: number;
  unreadable: number;
}

export interface PurgeEntryImage {
  ticket: string;
  size: number;
}

export interface PurgeEntry {
  id: string;
  runBy: string;
  ranAt: number;
  bytes: number;
  images: PurgeEntryImage[];
  tickets: string[];
}
