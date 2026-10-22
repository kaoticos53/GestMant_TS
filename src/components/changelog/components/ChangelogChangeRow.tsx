import type { ChangeCategory } from "@/lib/changelog";
import { getCategoryLabel } from "@/lib/changelog";
import { AlertCircle, Shield, Sparkles, Tag, Wrench } from "lucide-react";
import { getCategoryBadgeClass } from "../helpers";
import type { ChangelogChangeRowProps } from "../types";

function CategoryIcon({ category }: { category: ChangeCategory }) {
  switch (category) {
    case "novedad":
      return <Sparkles className="size-3 text-emerald-500" />;
    case "mejora":
      return <Wrench className="size-3 text-sky-500" />;
    case "correccion":
      return <AlertCircle className="size-3 text-amber-500" />;
    case "seguridad":
      return <Shield className="size-3 text-purple-500" />;
  }
}

export function ChangelogChangeRow({ change }: ChangelogChangeRowProps) {
  return (
    <div className="flex items-start gap-2.5 text-xs p-2 rounded-md hover:bg-muted/30 transition-colors">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getCategoryBadgeClass(
          change.category,
        )}`}
      >
        <CategoryIcon category={change.category} />
        {getCategoryLabel(change.category)}
      </span>

      {change.tag && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded shrink-0">
          <Tag className="size-2.5" />
          {change.tag}
        </span>
      )}

      <span className="text-foreground/80 leading-snug">
        {change.description}
      </span>
    </div>
  );
}
