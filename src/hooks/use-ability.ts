import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  defineAbilityFor,
  emptyAbility,
  type AppAbility,
} from "@/lib/abilities";
import { useQuery } from "convex/react";
import { useMemo } from "react";

/**
 * El motor de permisos de la sesión, listo para preguntar.
 *
 * Las capacidades salen de la misma consulta que alimenta el menú del panel
 * (`myPermissions`): lo que el administrador marca en la pantalla de permisos
 * es lo que aquí se concede. Mientras la consulta no llega —o si falla— el motor
 * no concede nada: es el lado seguro, y las vistas que dependen de capacidades
 * ya se pintan con su esqueleto hasta tener datos.
 *
 * La persona y sus permisos se memorizan juntos para no reconstruir el motor en
 * cada render: `AppAbility` se usa como valor de contexto y cada objeto nuevo
 * volvería a pintar todas las preguntas de la interfaz.
 */
export function useAbility(): AppAbility {
  const { user } = useAuth();
  const permissions = useQuery(api.permissions.myPermissions);

  return useMemo(() => {
    if (!user) return emptyAbility();
    return defineAbilityFor(
      {
        id: user._id,
        role: user.role ?? "",
        active: user.active !== false,
        isAnonymous: user.isAnonymous === true,
      },
      permissions?.grants ?? {},
    );
  }, [user, permissions]);
}
