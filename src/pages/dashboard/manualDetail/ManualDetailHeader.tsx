import { Badge } from "@/components/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MANUAL_KIND_META } from "@/lib/manuals";
import { getManualSubtitle } from "./helpers";
import type { ManualDetailHeaderProps } from "./types";

export function ManualDetailHeader({ manual, linked }: ManualDetailHeaderProps) {
  const meta = MANUAL_KIND_META[manual.kind];

  return (
    <SheetHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={meta.badgeClassName}>
          {meta.label}
        </Badge>
        <Badge
          variant="outline"
          className="border-border bg-muted text-muted-foreground"
        >
          {manual.type}
        </Badge>
        {manual.brand && (
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            {manual.brand}
          </Badge>
        )}
        {manual.model && (
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            {manual.model}
          </Badge>
        )}
      </div>
      <SheetTitle className="text-xl tracking-tight">
        {manual.title}
      </SheetTitle>
      <SheetDescription>
        {getManualSubtitle(manual, linked)}
      </SheetDescription>
    </SheetHeader>
  );
}
