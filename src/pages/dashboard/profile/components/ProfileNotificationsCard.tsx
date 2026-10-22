import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/workshop";
import type { ProfileNotificationsCardProps } from "../types";

/** Tarjeta con el listado de avisos recientes del usuario. */
export function ProfileNotificationsCard({
  avisos,
}: ProfileNotificationsCardProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold">Avisos recientes</h3>
      </header>
      {avisos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No tienes avisos. Te avisaremos aquí cuando algo dependa de ti.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {avisos.map((item) => (
            <li
              key={item._id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.read ? "bg-border" : "bg-signal",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
