import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GLOBAL_SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["?"], label: "Mostrar u ocultar esta ayuda de atajos" },
  { keys: ["g", "i"], label: "Ir a Incidencias" },
  { keys: ["g", "p"], label: "Ir a Peticiones de repuesto" },
  { keys: ["g", "r"], label: "Ir a Repuestos" },
  { keys: ["g", "e"], label: "Ir a Equipos" },
  { keys: ["g", "m"], label: "Ir a Manuales" },
  { keys: ["g", "c"], label: "Ir a Compras" },
  { keys: ["g", "a"], label: "Ir a Analítica" },
  { keys: ["g", "o"], label: "Ir a Correo" },
];

const MAILBOX_SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["/"], label: "Enfocar el buscador de la carpeta" },
  { keys: ["j"], label: "Seleccionar el mensaje siguiente" },
  { keys: ["k"], label: "Seleccionar el mensaje anterior" },
  { keys: ["Esc"], label: "Cerrar mensaje abierto o limpiar búsqueda" },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-2xs">
      {children}
    </kbd>
  );
}

function ShortcutSection({
  title,
  items,
}: {
  title: string;
  items: { keys: string[]; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/15">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
          >
            <span className="min-w-0 break-words text-foreground">{item.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {item.keys.map((key, idx) => (
                <span key={key} className="inline-flex items-center gap-1">
                  {idx > 0 && (
                    <span className="text-xs text-muted-foreground">luego</span>
                  )}
                  <KeyCap>{key}</KeyCap>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Pulsa los atajos fuera de cuadros de texto para navegar más rápido
            por el taller.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          <ShortcutSection title="Navegación general" items={GLOBAL_SHORTCUTS} />
          <ShortcutSection title="En el módulo Correo" items={MAILBOX_SHORTCUTS} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
