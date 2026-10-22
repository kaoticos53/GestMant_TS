import { Badge } from "@/components/ui/badge";
import { richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import { PRIORITY_META, STATUS_META } from "@/lib/workshop";
import { ArrowRight } from "lucide-react";
import type { ProfileRequestsCardProps } from "../types";

/** Tarjeta con el listado de peticiones de repuesto creadas recientemente por el usuario. */
export function ProfileRequestsCard({
  requests,
  onOpenRequests,
}: ProfileRequestsCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold">
          Mis peticiones de repuesto
        </h3>
        <button
          type="button"
          onClick={onOpenRequests}
          className="flex items-center gap-1 text-xs font-medium text-signal hover:underline"
        >
          Ver cola
          <ArrowRight className="size-3.5" />
        </button>
      </header>
      {requests.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Todavía no has creado ninguna petición de material.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {requests.map((request) => (
            <li key={request._id}>
              <button
                type="button"
                onClick={onOpenRequests}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {request.reference}
                </span>
                <Badge
                  variant="outline"
                  className={
                    STATUS_META[request.status]?.badgeClassName ??
                    STATUS_META.pending.badgeClassName
                  }
                >
                  {STATUS_META[request.status]?.label ??
                    STATUS_META.pending.label}
                </Badge>
                <span
                  className={cn(
                    "text-xs",
                    PRIORITY_META[request.priority].label === "Urgente"
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {PRIORITY_META[request.priority].label}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                  {request.equipment ??
                    richDocToPlainText(request.description)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
