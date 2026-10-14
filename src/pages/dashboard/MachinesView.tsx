import { Badge } from "@/components/ui/badge";
import { MACHINE_SHEET, type SheetState } from "@/lib/machineSheet";
import { cn } from "@/lib/utils";
import { ArrowRight, Ban } from "lucide-react";

/**
 * Las tres máquinas del taller —la incidencia, la petición de repuestos y la
 * compra, con la orden que la compra lleva dentro—, un bloque por estado.
 *
 * Lo que se pinta sale entero de `lib/machineSheet`, que lo lee de las tablas del
 * código: aquí no hay ni una transición escrita a mano, así que la pantalla no
 * puede contar una cosa distinta de la que hace el servidor. Es la respuesta a
 * «¿dónde está este caso y qué se puede hacer desde ahí?» sin abrir un fichero.
 *
 * Los motivos («primero verifícala», «ya está completada: entró todo lo que se
 * pidió») son los mismos textos que la ficha del caso enseña al intentarlo.
 */
export function MachinesView() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Dónde puede estar un caso y qué se hace desde ahí, leído del código que
        lo decide: lo mismo que te dice la ficha de un caso, todo junto y sin
        abrir nada.
      </p>

      {MACHINE_SHEET.map((machine) => (
        <section
          key={machine.id}
          data-machine={machine.id}
          className="rounded-xl border border-border/70 bg-card shadow-sm"
        >
          <header className="border-b border-border/70 p-4">
            <h2 className="text-lg font-semibold">{machine.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {machine.note}
            </p>
          </header>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {machine.states.map((state) => (
              <BloqueDeEstado key={state.key} state={state} />
            ))}
          </div>
        </section>
      ))}

      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        Quién puede dar cada paso no está aquí —eso son las capacidades de tu
        rol, en «Roles y permisos»—, y una máquina que no sabe explicar por qué
        no se puede dar un paso se queda sin esa línea en vez de inventarla.
      </p>
    </div>
  );
}

/** Un estado: cómo se llama, qué se puede hacer desde él y qué no. */
function BloqueDeEstado({ state }: { state: SheetState }) {
  return (
    <div
      data-state={state.key}
      className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={state.badgeClassName}>
          {state.label}
        </Badge>
        <code className="font-mono text-[11px] text-muted-foreground">
          {state.key}
        </code>
      </div>

      {state.description && (
        <p className="text-xs leading-5 text-muted-foreground">
          {state.description}
        </p>
      )}

      {state.steps.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          No hay ningún paso desde aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {state.steps.map((step) => (
            <li
              key={step.action}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              <span className="font-medium">{step.label}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              {step.to.kind === "status" ? (
                <Badge
                  variant="outline"
                  className={cn("font-normal", step.to.badgeClassName)}
                >
                  {step.to.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground">{step.to.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.blocked.length > 0 && (
        <div className="border-t border-border/60 pt-2">
          <p className="text-[11px] font-medium text-foreground/70">
            No se puede desde aquí
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {state.blocked.map((group) => (
              <li
                key={group.reason}
                className="flex gap-1.5 text-[11px] leading-5 text-muted-foreground"
              >
                <Ban className="mt-0.5 size-3 shrink-0" />
                <span>
                  <span className="font-medium text-foreground/80">
                    {group.labels.join(" · ")}
                  </span>
                  : {group.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
