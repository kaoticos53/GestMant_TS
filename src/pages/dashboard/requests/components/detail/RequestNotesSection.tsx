import { RichText } from "@/components/RichText";
import { User } from "lucide-react";
import type { RequestNotesSectionProps } from "./types";

export function RequestNotesSection({
  description,
  notes,
}: RequestNotesSectionProps) {
  return (
    <>
      {description && (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Qué pide
          </p>
          <RichText value={description} className="mt-1.5" />
        </div>
      )}

      {notes && (
        <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="size-3.5" />
            Nota del solicitante
          </p>
          <RichText value={notes} className="mt-1.5" />
        </div>
      )}
    </>
  );
}
