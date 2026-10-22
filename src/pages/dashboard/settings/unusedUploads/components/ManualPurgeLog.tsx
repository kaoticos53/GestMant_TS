import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { cleanupCount, cleanupTicketsLabel } from "@/lib/cleanupLog";
import { formatDateTime, formatFileSize } from "@/lib/workshop";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/**
 * La constancia de las purgas a mano, debajo del botón que las hace: quién, cuándo
 * y qué se llevó cada una, con sus vales a un clic. Las pasadas de la madrugada no
 * aparecen aquí a propósito —tienen la suya, con la última vez de cada una—: esto
 * es la firma de lo que decide una persona, y con nombre y apellidos, porque es lo
 * único que quedará de un archivo que nadie citó.
 */
export function ManualPurgeLog() {
  const purges = useQuery(api.cleanupLog.purges);
  // Un solo detalle abierto a la vez: la lista se lee de un vistazo y los vales
  // aparecen cuando se piden.
  const [openId, setOpenId] = useState<string | null>(null);
  const entries = purges?.entries ?? [];

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Constancia de las purgas a mano
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Quién purgó, cuándo y qué se llevó. Las pasadas de la madrugada no se
        firman aquí: esto es lo que hizo una persona.
      </p>

      {purges === undefined ? (
        <Skeleton className="mt-2 h-12 rounded-lg" />
      ) : entries.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
          Todavía no ha purgado nadie a mano. La primera purga deja aquí su
          firma, con la lista de lo que se llevó.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {entries.map((entry) => {
            const total = entry.images.length + entry.tickets.length;
            const open = openId === entry.id;
            const counted = [
              entry.images.length > 0
                ? `${cleanupCount("reportUploads", entry.images.length)} (${formatFileSize(
                    entry.bytes,
                  )})`
                : null,
              entry.tickets.length > 0
                ? cleanupTicketsLabel(entry.tickets.length)
                : null,
            ].filter((part): part is string => part !== null);
            return (
              <li
                key={entry.id}
                className="rounded-lg border border-border/70 p-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{entry.runBy}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatDateTime(entry.ranAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {counted.join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setOpenId(open ? null : entry.id)}
                  >
                    {open ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    {open ? "Ocultar" : `Ver qué se llevó (${total})`}
                  </Button>
                </div>

                {open && (
                  <ul className="mt-2 grid gap-1 border-t border-border/60 pt-2">
                    {entry.images.map((image) => (
                      <li
                        key={image.ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{image.ticket}</span>
                        <span className="shrink-0">
                          {formatFileSize(image.size)}
                        </span>
                      </li>
                    ))}
                    {entry.tickets.map((ticket) => (
                      <li
                        key={ticket}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{ticket}</span>
                        <span className="shrink-0">vale sin archivo</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {purges?.partial && (
            <li className="text-[11px] leading-5 text-muted-foreground">
              Se enseñan las últimas {entries.length} purgas a mano; las de
              antes siguen guardadas.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
