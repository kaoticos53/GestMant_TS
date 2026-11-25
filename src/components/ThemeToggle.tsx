import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { id: "light", label: "Claro", title: "Tema claro", icon: Sun },
  { id: "dark", label: "Oscuro", title: "Tema oscuro", icon: Moon },
  { id: "system", label: "Sistema", title: "Tema del sistema", icon: Monitor },
] as const;

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const currentTheme = theme ?? "system";

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className={cn(
        "inline-flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5",
        !compact && "w-full",
        className,
      )}
    >
      {THEME_OPTIONS.map(({ id, label, title, icon: Icon }) => {
        const active = currentTheme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            aria-label={title}
            title={title}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact
                ? "size-8"
                : "min-h-8 flex-1 px-2 py-1 text-xs",
              active
                ? "bg-signal/15 text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
