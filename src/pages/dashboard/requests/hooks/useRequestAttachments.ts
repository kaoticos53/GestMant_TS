import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  FILE_ACCEPT,
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";

export interface PendingRequestFile {
  id: string;
  file: File;
  previewUrl?: string;
  storageId?: Id<"_storage">;
  uploading: boolean;
  error?: string;
}

export interface UseRequestAttachmentsOptions {
  generateUploadUrl: () => Promise<string>;
}

export interface UseRequestAttachmentsReturn {
  files: PendingRequestFile[];
  isUploading: boolean;
  failedFile: PendingRequestFile | undefined;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  openFileDialog: () => void;
  handleFilesChosen: (chosen: FileList | null) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  fileAccept: string;
}

/**
 * Hook para gestionar la selección, compresión, subida asíncrona y
 * ciclo de vida seguro de recursos Blob para los adjuntos de una petición.
 */
export function useRequestAttachments({
  generateUploadUrl,
}: UseRequestAttachmentsOptions): UseRequestAttachmentsReturn {
  const [files, setFiles] = useState<PendingRequestFile[]>([]);
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Revocación determinista de URLs al desmontar el componente para evitar fugas de memoria
  useEffect(() => {
    const urlsToRevoke = activeBlobUrlsRef.current;
    return () => {
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
      urlsToRevoke.clear();
    };
  }, []);

  const uploadFile = useCallback(
    async (entry: PendingRequestFile) => {
      try {
        const uploadUrl = await generateUploadUrl();
        const storageId = await uploadToStorage(uploadUrl, entry.file);
        setFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? { ...item, storageId, uploading: false }
              : item,
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo subir el archivo.";
        setFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? { ...item, uploading: false, error: message }
              : item,
          ),
        );
      }
    },
    [generateUploadUrl],
  );

  const handleFilesChosen = useCallback(
    async (chosen: FileList | null) => {
      if (!chosen || chosen.length === 0) return;
      const accepted: PendingRequestFile[] = [];

      for (const picked of Array.from(chosen)) {
        const file = await compressForUpload(picked);
        if (exceedsFileLimit(file)) {
          toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
          continue;
        }

        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;

        if (previewUrl) {
          activeBlobUrlsRef.current.add(previewUrl);
        }

        const entry: PendingRequestFile = {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          file,
          previewUrl,
          uploading: true,
        };
        accepted.push(entry);
      }

      if (accepted.length === 0) return;

      setFiles((current) => [...current, ...accepted]);
      accepted.forEach((entry) => void uploadFile(entry));
    },
    [uploadFile],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const target = current.find((file) => file.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        activeBlobUrlsRef.current.delete(target.previewUrl);
      }
      return current.filter((file) => file.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrlsRef.current.clear();
    setFiles([]);
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const isUploading = files.some((file) => file.uploading);
  const failedFile = files.find((file) => Boolean(file.error));

  return {
    files,
    isUploading,
    failedFile,
    fileInputRef,
    openFileDialog,
    handleFilesChosen,
    removeFile,
    clearFiles,
    fileAccept: FILE_ACCEPT,
  };
}
