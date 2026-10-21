import { Badge } from "@/components/ui/badge";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PackageCheck, Wrench } from "lucide-react";

export interface RequestHeaderProps {
  reference: string;
  requesterName: string;
  priority: { label: string; badgeClassName: string };
  status: {
    label: string;
    badgeClassName: string;
    dotClassName?: string;
    description?: string;
  };
  material: string;
  noReference: boolean;
  hasEquipmentId: boolean;
}

export function RequestHeader({
  reference,
  requesterName,
  priority,
  status,
  material,
  noReference,
  hasEquipmentId,
}: RequestHeaderProps) {
  return (
    <SheetHeader className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-muted-foreground">
          {reference}
        </span>
        <Badge variant="outline" className={priority.badgeClassName}>
          {priority.label}
        </Badge>
        <Badge variant="outline" className={status.badgeClassName}>
          <span
            className={cn("size-1.5 rounded-full", status.dotClassName)}
          />
          {status.label}
        </Badge>
        {material === "partial" && (
          <Badge
            variant="outline"
            className="border-amber-500/25 bg-amber-500/10 text-amber-700"
          >
            <PackageCheck className="size-3" />
            Entrega parcial
          </Badge>
        )}
        {noReference && (
          <Badge
            variant="outline"
            className="border-amber-500/25 bg-amber-500/10 text-amber-700"
          >
            <Wrench className="size-3" />
            Sin repuesto
          </Badge>
        )}
        {hasEquipmentId && (
          <Badge
            variant="outline"
            className="border-signal/25 bg-signal/10 text-signal"
          >
            Modelo en inventario
          </Badge>
        )}
      </div>
      <SheetTitle className="text-xl tracking-tight">
        {requesterName}
      </SheetTitle>
      {status.description && (
        <SheetDescription>{status.description}</SheetDescription>
      )}
    </SheetHeader>
  );
}
