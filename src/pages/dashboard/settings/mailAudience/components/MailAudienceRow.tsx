import { Switch } from "@/components/ui/switch";
import { MAIL_ORIGIN_LABELS } from "@/lib/mail";
import { roleBadgeClassName } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { COLUMNAS, DESTINO_FIJO, LA_MATRIZ } from "../helpers";
import type { RoleOption } from "../types";

export interface MailAudienceRowProps {
  option: RoleOption;
  incidentKeys: string[];
  weeklyKeys: string[];
  saving: boolean;
  onToggle: (
    which: "incident" | "weekly",
    key: string,
    checked: boolean,
  ) => void;
}

export function MailAudienceRow({
  option,
  incidentKeys,
  weeklyKeys,
  saving,
  onToggle,
}: MailAudienceRowProps) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 md:grid md:items-center md:gap-x-2 md:gap-y-0",
        LA_MATRIZ,
      )}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {option.label}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClassName(option.key)}`}
          >
            {option.key}
          </span>
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {option.description}
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 md:contents">
        {COLUMNAS.map((column) => {
          const list = column.list;
          const hint = DESTINO_FIJO[column.origin];

          return (
            <div
              key={column.origin}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 md:w-full md:flex-none"
            >
              {list === null ? (
                <span
                  title={hint}
                  className="whitespace-nowrap rounded-full border border-border/70 px-2 py-0.5 text-[10px] leading-4 text-muted-foreground"
                >
                  <span className="sr-only">{`${MAIL_ORIGIN_LABELS[column.origin]}: ${hint ?? ""} `}</span>
                  {column.fixed}
                </span>
              ) : (
                <Switch
                  checked={(list === "incident" ? incidentKeys : weeklyKeys).includes(
                    option.key,
                  )}
                  disabled={saving}
                  aria-label={`${MAIL_ORIGIN_LABELS[column.origin]} a ${option.label}`}
                  onCheckedChange={(checked) =>
                    onToggle(list, option.key, checked)
                  }
                />
              )}
              {/* El alto es el de dos líneas: «A quien notificó» no cabe en una, y
                  sin él las demás etiquetas suben y la fila queda torcida. */}
              <span className="min-h-7 text-center text-[10px] leading-tight text-muted-foreground md:hidden">
                {column.short}
              </span>
            </div>
          );
        })}
      </div>
    </li>
  );
}
