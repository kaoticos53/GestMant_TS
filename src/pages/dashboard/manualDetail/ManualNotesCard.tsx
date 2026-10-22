import { RichText } from "@/components/RichText";
import { NotebookPen } from "lucide-react";
import type { ManualNotesCardProps } from "./types";

export function ManualNotesCard({ notes }: ManualNotesCardProps) {
  if (!notes) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
        Este manual no lleva nota del taller.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <NotebookPen className="size-3.5" />
        Nota del taller
      </p>
      <RichText value={notes} className="mt-2" />
    </div>
  );
}
