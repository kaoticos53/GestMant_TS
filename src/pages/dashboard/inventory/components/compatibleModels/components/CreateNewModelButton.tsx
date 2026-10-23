import { Plus, Sparkles } from "lucide-react";
import type { CreateNewModelButtonProps } from "../types";

export function CreateNewModelButton({
  query,
  disabled,
  onCreate,
}: CreateNewModelButtonProps) {
  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <span className="flex items-center gap-2 truncate">
        <Sparkles className="size-3.5 shrink-0 text-amber-500" />
        <span>
          Registrar nuevo modelo «<strong>{query}</strong>» y asociar
        </span>
      </span>
      <Plus className="size-3.5 shrink-0" />
    </button>
  );
}
