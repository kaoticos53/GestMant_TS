import { RichText } from "@/components/RichText";
import { richDocIsEmpty } from "@/lib/richDoc";
import type { RequestDoc } from "../types";

export function DecisionNotes({ request }: { request: RequestDoc }) {
  const notes: { label: string; value: string | undefined }[] = [
    { label: "Nota de la decisión", value: request.decisionNote },
    { label: "Nota de la entrega", value: request.issueNote },
    { label: "Motivo de la espera", value: request.holdNote },
    { label: "Motivo de la devolución", value: request.returnNote },
    { label: "Motivo de la cancelación", value: request.cancelNote },
  ];
  const written = notes.filter(
    (note) => note.value !== undefined && !richDocIsEmpty(note.value),
  );
  if (written.length === 0) return null;

  return (
    <>
      {written.map((note) => (
        <div
          key={note.label}
          className="rounded-xl border border-border/70 bg-muted/50 p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {note.label}
          </p>
          <RichText value={note.value} className="mt-1.5" />
        </div>
      ))}
    </>
  );
}
