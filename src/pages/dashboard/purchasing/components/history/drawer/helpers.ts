export type FechaTipoFilter = "pedido" | "recepcion" | "ambas";

export type EstadoEntregaFilter =
  | "todos"
  | "pendientes"
  | "recibidos"
  | "parciales";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

export const FECHA_TIPO_OPTIONS: readonly FilterOption<FechaTipoFilter>[] = [
  { value: "pedido", label: "Fecha de pedido (F. PEDIDO)" },
  { value: "recepcion", label: "Fecha de recepción (F. RECEP.)" },
  { value: "ambas", label: "Cualquiera de las dos" },
] as const;

export const ESTADO_ENTREGA_OPTIONS: readonly FilterOption<EstadoEntregaFilter>[] =
  [
    { value: "todos", label: "Todos los estados" },
    { value: "pendientes", label: "Pendientes (con piezas por recibir)" },
    { value: "recibidos", label: "Completados (todo recibido)" },
    { value: "parciales", label: "Recibidos parcialmente" },
  ] as const;

export function getFechaTipoLabel(value: string): string {
  const match = FECHA_TIPO_OPTIONS.find((opt) => opt.value === value);
  return match?.label ?? "Fecha de pedido (F. PEDIDO)";
}

export function getEstadoEntregaLabel(value: string): string {
  const match = ESTADO_ENTREGA_OPTIONS.find((opt) => opt.value === value);
  return match?.label ?? "Todos los estados";
}
