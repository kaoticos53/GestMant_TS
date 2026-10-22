import { describe, expect, it } from "vitest";
import {
  canUserEditNote,
  formatNoteEditDeadlineNotice,
  formatNoteTimestamp,
  getNoteDialogDescription,
  getNoteDialogTitle,
  getNoteSubmitLabel,
  getNoteWrittenAt,
} from "@/pages/dashboard/incidents/components/detail/notes/helpers";
import type { IncidentLifecycleNote } from "@/pages/dashboard/incidents/components/detail/notes/types";

describe("incidentNotesCard helpers", () => {
  describe("getNoteWrittenAt", () => {
    it("utiliza createdAt si está presente", () => {
      expect(getNoteWrittenAt({ createdAt: 1000, at: 2000 })).toBe(1000);
    });

    it("utiliza at si createdAt no está presente", () => {
      expect(getNoteWrittenAt({ at: 2000 })).toBe(2000);
    });
  });

  describe("canUserEditNote", () => {
    it("devuelve false si currentUserId es null", () => {
      expect(
        canUserEditNote(
          { authorId: "u1", at: Date.now() },
          null,
        ),
      ).toBe(false);
    });

    it("devuelve false si el usuario no es el autor", () => {
      expect(
        canUserEditNote(
          { authorId: "u1", at: Date.now() },
          "u2",
        ),
      ).toBe(false);
    });

    it("devuelve true si el usuario es el autor y está dentro de la ventana de edición", () => {
      expect(
        canUserEditNote(
          { authorId: "u1", at: Date.now() },
          "u1",
        ),
      ).toBe(true);
    });

    it("devuelve false si la ventana de edición ha expirado (más de 1 hora)", () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      expect(
        canUserEditNote(
          { authorId: "u1", at: twoHoursAgo },
          "u1",
        ),
      ).toBe(false);
    });
  });

  describe("formatNoteTimestamp", () => {
    it("formatea autor y fecha básica sin correcciones", () => {
      const entry = {
        author: "Carlos Ruiz",
        at: 1714560000000,
        note: "Revisado",
      } as IncidentLifecycleNote;

      const result = formatNoteTimestamp(entry);
      expect(result).toContain("Carlos Ruiz");
    });

    it("incluye información de corrección cuando editedAt está presente", () => {
      const entry = {
        author: "Carlos Ruiz",
        at: 1714560000000,
        editedAt: 1714563600000,
        note: "Corregido",
      } as IncidentLifecycleNote;

      const result = formatNoteTimestamp(entry);
      expect(result).toContain("corregida");
    });
  });

  describe("formatNoteEditDeadlineNotice", () => {
    it("devuelve texto con prefijo 'Se puede corregir hasta las'", () => {
      const notice = formatNoteEditDeadlineNotice(Date.now());
      expect(notice).toContain("Se puede corregir hasta las");
    });
  });

  describe("dialog titles and descriptions", () => {
    it("getNoteDialogTitle devuelve títulos según isEditing", () => {
      expect(getNoteDialogTitle(true)).toBe("Corregir nota");
      expect(getNoteDialogTitle(false)).toBe("Añadir nota");
    });

    it("getNoteDialogDescription incluye la referencia de la incidencia", () => {
      expect(getNoteDialogDescription(true, "INC-101")).toContain("INC-101");
      expect(getNoteDialogDescription(false, "INC-101")).toContain("INC-101");
    });

    it("getNoteSubmitLabel devuelve estados de guardado adecuados", () => {
      expect(getNoteSubmitLabel(true, false)).toBe("Guardando...");
      expect(getNoteSubmitLabel(false, true)).toBe("Guardar cambios");
      expect(getNoteSubmitLabel(false, false)).toBe("Añadir nota");
    });
  });
});
