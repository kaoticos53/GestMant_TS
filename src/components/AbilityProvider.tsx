import { type ReactNode } from "react";
import { AbilityProvider as CaslAbilityProvider, Can } from "@casl/react";
import { useAbility } from "@/hooks/use-ability";

/**
 * El motor de permisos, repartido por la interfaz.
 *
 * `@casl/react` trae su propio contexto y su componente `<Can>`; aquí solo se
 * rellenan con el motor de la sesión (`useAbility`) y se exportan con el resto
 * de la aplicación. El proveedor envuelve el panel, no la aplicación entera: las
 * páginas públicas —el aviso de incidencia, el seguimiento— no preguntan por
 * permisos de taller y no tienen por qué cargar con ellos.
 *
 * Las vistas que preguntan por permisos esperan encontrarlo: fuera de él,
 * `Can` avisa en lugar de adivinar, y así una vista que se monte suelta —en una
 * prueba o en una ruta nueva— se nota en el primer render.
 */
export { Can };

export function AbilityProvider({ children }: { children: ReactNode }) {
  const ability = useAbility();
  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
}
