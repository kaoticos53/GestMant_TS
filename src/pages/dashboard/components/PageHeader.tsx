import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

/** Una acción de la cabecera: lo que no es del día a día va al menú «⋯». */
export interface PageHeaderAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Se dibuja un separador antes de esta acción. */
  separatorBefore?: boolean;
}

/**
 * La cabecera de un módulo del panel, en una sola franja.
 *
 * Antes, cada módulo encabezaba la pantalla con cuatro pisos: el rol en
 * versalitas, un titular de 36 px, dos o tres líneas de explicación y una fila
 * de botones globales (resumen semanal, ajustes, aviso, datos de ejemplo).
 * Sumaban más de 300 px —un tercio de un portátil— antes de la primera ficha,
 * y con ellos el pie de la lista se comía la página: en Peticiones cabían dos
 * fichas por pantalla y había que pasar 32 páginas para ver 64.
 *
 * Aquí manda lo que se viene a hacer: **el nombre del módulo y cuánto hay**.
 * La explicación larga se queda en una línea (con el texto entero en el
 * `title`, para quien lo necesite) y lo que no es de todos los días —el resumen
 * semanal, el aviso cerrado, los datos de ejemplo— vive en el menú «⋯», no en
 * una fila de botones que se lee en cada visita.
 *
 * La acción propia del módulo —«Nueva petición», «Notificar incidencia»— no
 * está aquí: vive en la barra de su lista, junto a lo que ordena y filtra, que
 * es donde se usa. Así tampoco se duplica.
 */
export function PageHeader({
  title,
  count,
  description,
  actions = [],
}: {
  /** El nombre del módulo: es el `h1` de la pantalla. */
  title: string;
  /** Cuánto hay, junto al título. Sin cifra, no se pinta. */
  count?: number | null;
  /** Una línea de contexto; el texto completo va en el `title`. */
  description: string;
  /** Lo que se puede hacer desde aquí, fuera del menú de la barra lateral. */
  actions?: PageHeaderAction[];
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {typeof count === "number" && count > 0 && (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
              title={`${count} en ${title.toLowerCase()}`}
            >
              {count}
            </span>
          )}
        </div>
        {/* En el móvil la línea de contexto no cabe: se oculta en vez de
            cortarla a mitad de frase. */}
        <p
          title={description}
          className="mt-0.5 hidden max-w-2xl line-clamp-1 text-sm text-muted-foreground sm:block"
        >
          {description}
        </p>
      </div>

      {actions.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                aria-label="Más acciones del módulo"
                title="Más acciones del módulo"
              >
                <MoreHorizontal className="size-4" />
                <span className="hidden sm:inline">Acciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Taller
              </DropdownMenuLabel>
              {actions.map((action) => (
                <div key={action.label}>
                  {action.separatorBefore && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={action.disabled}
                    onSelect={() => action.onSelect()}
                    className="gap-2"
                  >
                    <action.icon className="size-4 shrink-0 text-muted-foreground" />
                    {action.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
