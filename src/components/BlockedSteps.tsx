/**
 * «¿Por qué no puedo…?»: las acciones que la máquina conoce y que desde el estado
 * actual no se pueden dar, con el motivo que da ella misma —«primero devuélvela
 * desde “Devolver material”», «tiene material comprometido»—.
 *
 * La ficha lo enseña al lado de sus botones en vez de esconder la acción sin más:
 * quien mira entiende qué falta, en vez de buscarlo. Los pasos que comparten
 * motivo llegan ya agrupados —eso lo decide la máquina, que es quien sabe si dos
 * reglas dicen lo mismo— y aquí solo se escriben.
 */
export interface BlockedStepGroup {
  /** Los pasos que comparten motivo, con el nombre con el que se leen. */
  label: string;
  /** El porqué, contado por la máquina. */
  reason: string;
}

export function BlockedSteps({ groups }: { groups: BlockedStepGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="w-full rounded-lg border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <p className="font-medium uppercase tracking-wide">Por qué no se puede</p>
      <ul className="mt-1 space-y-0.5">
        {groups.map((group) => (
          <li key={group.label}>
            <span className="font-medium text-foreground/70">
              {group.label}:
            </span>{" "}
            {group.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
