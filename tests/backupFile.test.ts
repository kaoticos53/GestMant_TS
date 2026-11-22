import { describe, expect, it } from "vitest";
import {
  BACKUP_FILE_FORMAT,
  MIN_BACKUP_PASSPHRASE,
  isProtectedBackup,
  protectBackup,
  unlockBackup,
} from "@/lib/backupFile";

const PASSPHRASE = "frase-de-copia-2026";

function sampleBackup() {
  return JSON.stringify({
    format: "pulso-taller-backup",
    version: 2,
    exportedAt: 1_700_000_000_000,
    exportedBy: "admin@taller.es",
    tables: {
      equipment: Array.from({ length: 400 }, (_, i) => ({
        _id: `eq_${i}`,
        name: `Cámara de taller ${i}`,
        notes: "Revisión anual y limpieza del sensor.",
      })),
    },
  });
}

describe("Archivo de copia protegido", () => {
  it("comprime, cifra y devuelve el mismo JSON al desbloquear", async () => {
    const raw = sampleBackup();
    const protectedText = await protectBackup(raw, PASSPHRASE);

    expect(isProtectedBackup(protectedText)).toBe(true);
    expect(isProtectedBackup(raw)).toBe(false);
    expect(protectedText).not.toContain("Cámara de taller");
    expect(protectedText.length).toBeLessThan(raw.length);

    const envelope = JSON.parse(protectedText) as {
      format: string;
      compression: string;
      protection: string;
      payload: string;
    };
    expect(envelope.format).toBe(BACKUP_FILE_FORMAT);
    expect(envelope.compression).toBe("gzip");
    expect(envelope.protection).toBe("AES-GCM-256+HMAC-SHA256");

    await expect(unlockBackup(protectedText, PASSPHRASE)).resolves.toBe(raw);
  });

  it("rechaza una frase distinta sin descifrar la copia", async () => {
    const protectedText = await protectBackup(sampleBackup(), PASSPHRASE);
    await expect(
      unlockBackup(protectedText, "otra-frase-distinta"),
    ).rejects.toThrow(/frase no es correcta/i);
  });

  it("detecta una copia manipulada antes de descifrarla", async () => {
    const protectedText = await protectBackup(sampleBackup(), PASSPHRASE);
    const envelope = JSON.parse(protectedText) as { payload: string };
    const payload = envelope.payload;
    const changed = `${payload.slice(0, 8)}${payload[8] === "A" ? "B" : "A"}${payload.slice(9)}`;
    const tampered = JSON.stringify({ ...envelope, payload: changed });

    await expect(unlockBackup(tampered, PASSPHRASE)).rejects.toThrow(
      /frase no es correcta|dañado/i,
    );
  });

  it("exige una frase suficientemente larga y una cabecera conocida", async () => {
    await expect(protectBackup(sampleBackup(), "corta")).rejects.toThrow(
      new RegExp(String(MIN_BACKUP_PASSPHRASE)),
    );

    await expect(
      unlockBackup(
        JSON.stringify({ format: BACKUP_FILE_FORMAT, version: 99 }),
        PASSPHRASE,
      ),
    ).rejects.toThrow(/versión/i);
  });
});
