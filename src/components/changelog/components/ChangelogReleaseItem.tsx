import { Badge } from "@/components/ui/badge";
import { formatReleaseDate } from "@/lib/changelog";
import { Calendar, CheckCircle2 } from "lucide-react";
import type { ChangelogReleaseItemProps } from "../types";
import { ChangelogChangeRow } from "./ChangelogChangeRow";

export function ChangelogReleaseItem({
  release,
  isCurrent,
}: ChangelogReleaseItemProps) {
  return (
    <div className="relative group">
      {/* Hito en la línea de tiempo */}
      <span
        aria-hidden="true"
        className={`absolute -left-[31px] top-1 size-3.5 rounded-full border-2 border-background transition-transform ${
          isCurrent
            ? "bg-primary ring-4 ring-primary/20 scale-110"
            : "bg-muted-foreground/40 group-hover:bg-primary/70"
        }`}
      />

      {/* Cabecera de la versión */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-foreground">
            v{release.version}
          </span>
          {isCurrent && (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold"
            >
              Versión actual
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          <time dateTime={release.date}>
            {formatReleaseDate(release.date)}
          </time>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-foreground/90 mt-1">
        {release.title}
      </h4>

      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {release.summary}
      </p>

      {/* Destacados si los tiene */}
      {release.highlights && release.highlights.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1.5">
            Puntos clave
          </span>
          <ul className="space-y-1">
            {release.highlights.map((h, i) => (
              <li
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-1.5"
              >
                <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista de cambios categorizados */}
      <div className="mt-3 space-y-2">
        {release.changes.map((change, idx) => (
          <ChangelogChangeRow key={idx} change={change} />
        ))}
      </div>
    </div>
  );
}
