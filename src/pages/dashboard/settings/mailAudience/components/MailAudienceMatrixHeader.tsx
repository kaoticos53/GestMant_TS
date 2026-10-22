import { MAIL_ORIGIN_LABELS } from "@/lib/mail";
import { cn } from "@/lib/utils";
import { COLUMNAS, LA_MATRIZ } from "../helpers";

export function MailAudienceMatrixHeader() {
  return (
    <div
      className={cn(
        // El borde de las filas se repite aquí, transparente: la rejilla se
        // mide sobre el contenido, y sin él la cabecera cae un píxel a la
        // derecha de sus interruptores.
        "mt-4 hidden items-end gap-x-2 border border-transparent px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid",
        LA_MATRIZ,
      )}
    >
      <span>Rol</span>
      {COLUMNAS.map((column) => (
        <span
          key={column.origin}
          className="text-center text-[10px] leading-4"
        >
          {MAIL_ORIGIN_LABELS[column.origin]}
          {column.list === null && (
            <span className="mt-0.5 block font-normal normal-case tracking-normal">
              fijo
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
