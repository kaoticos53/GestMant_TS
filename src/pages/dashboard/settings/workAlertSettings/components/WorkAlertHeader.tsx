import { BellRing } from "lucide-react";

export function WorkAlertHeader() {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <BellRing className="size-4" />
      </span>
      <div className="max-w-xl">
        <p className="text-sm font-semibold tracking-tight">
          Aviso de trabajo sin constancia
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          El panel avisa de las incidencias que llevan días en curso sin que
          quien las trabaja haya escrito una sola nota: trabajo que avanza sin
          dejar rastro en el cuaderno. Aquí decides con cuántos días avisa y a
          qué roles les llega.
        </p>
      </div>
    </div>
  );
}
