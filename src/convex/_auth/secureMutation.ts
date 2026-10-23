import type { ObjectType, PropertyValidators } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { Capability } from "../../lib/permissions";
import type { MutationCtx } from "../_generated/server";
import type { IdentityIssue } from "../permissions";
import {
  hasAnyCapability,
  hasCapability,
  memberStatus,
} from "../permissions";

/**
 * La puerta que comparten las mutaciones del taller.
 *
 * Las mutaciones repetían la misma cabecera —«mira quién eres, mira si tu rol
 * tiene la capacidad, si no, lanza un `ConvexError` con el motivo»— y cada copia
 * se acordaba de unas cosas y de otras no. Aquí está una vez:
 *
 * 1. **Identidad.** Sin sesión, con la cuenta dada de baja o desde una sesión
 *    anónima no se pasa. `identityMessage` es el aviso de ese caso, porque a
 *    quien no ha entrado no se le puede hablar de los permisos de un rol que no
 *    tiene; los módulos que distinguían la cuenta dada de baja lo hacen con
 *    `identityNotice`.
 * 2. **Capacidad.** La que se declare, con `hasCapability` —las habilidades del
 *    rol tal y como el administrador las configura—. Sin `capability`, basta con
 *    ser del taller; con `capabilities`, basta con tener una de ellas.
 * 3. **Política de la ficha.** Cuando la decisión no es «qué rol eres» sino
 *    «qué pasa con esta incidencia» —el técnico asignado también puede
 *    cerrarla, una petición ya resuelta no se toca—, `authorize` recibe el actor
 *    ya resuelto y devuelve el aviso que corresponde o `null`.
 *
 * El manejador recibe el actor como tercer argumento: la comprobación ya pagó
 * esa lectura y las mutaciones lo necesitan para firmar la historia, avisar o
 * comparar propiedad. No hay que volver a pedirlo dentro.
 *
 * **Sobre la traza de las denegaciones.** Aquí no se escribe en
 * `securityAuditLog`: Convex revierte toda la transacción cuando la mutación
 * lanza, así que un registro escrito justo antes del `ConvexError` se perdería
 * igual (comprobado con el arnés; programarlo tampoco sirve, el trabajo
 * programado viaja en la misma transacción). La traza de seguridad sigue
 * guardando lo que sí se completa —cambios de rol, estados de cuenta, vaciados—
 * y una denegación se queda en el aviso que recibe quien la intentó. Si algún día
 * hace falta un rastro de intentos, tiene que nacer fuera de la mutación que
 * falla: un action que capture el error y lo reporte, o el propio cliente.
 *
 * Se usa como el manejador de una mutación normal, con sus argumentos ya
 * validados delante:
 *
 * ```ts
 * export const create = mutation({
 *   args: equipmentArgs,
 *   handler: secureMutation(
 *     { capability: "manageEquipment" },
 *     equipmentArgs,
 *     async (ctx, args, actor) => { … },
 *   ),
 * });
 * ```
 */
export interface SecureMutationConfig<T extends PropertyValidators> {
  /** Capacidad que hace falta; sin ella basta con ser del taller. */
  capability?: Capability;
  /** Varias capacidades: basta con tener una de ellas. */
  capabilities?: readonly Capability[];
  /**
   * El motivo que se le enseña a quien se queda fuera. Puede depender del actor
   * —«los técnicos pueden autoasignarse las pendientes» solo tiene sentido
   * decírselo a un técnico—, así que también admite una función.
   */
  denyMessage?: string | ((actor: Doc<"users"> | null) => string);
  /**
   * El aviso de quien no ha entrado —o tiene la cuenta de baja—. Sin esto vería
   * el aviso de permisos de un rol que ni siquiera tiene; con esto se le dice lo
   * único que puede hacer: iniciar sesión. Los módulos que distinguían al
   * invitado, la cuenta de baja y quien no ha entrado pueden pasar una función y
   * recibir el motivo.
   */
  identityMessage?: string | ((issue: IdentityIssue) => string);
  /**
   * La parte que no cabe en una capacidad: propiedad de la ficha, quién la
   * lleva, un requisito de contexto. Devuelve el aviso que se le enseña a quien
   * se queda fuera, o `null` si puede pasar. Así una denegación se distingue de
   * un error de la propia operación —que el estado no permita el paso no es un
   * problema de permisos—.
   */
  authorize?: (
    ctx: MutationCtx,
    actor: Doc<"users">,
    args: ObjectType<T>,
  ) => Promise<string | null>;
}

/** El aviso de una cuenta dada de baja, igual en todo el taller. */
export const INACTIVE_ACCOUNT_MESSAGE =
  "Esta cuenta ha sido dada de baja o no está activa.";

/**
 * El aviso de identidad de siempre, pero sin tratar igual a una cuenta dada de
 * baja —existe y no puede entrar— que a quien no ha iniciado sesión o entra
 * como invitado. Los módulos con un texto propio para la baja pasan el suyo.
 */
export function identityNotice(
  general: string,
  inactive?: string,
): (issue: IdentityIssue) => string {
  // El aviso de baja se resuelve al llamar, no al construir el módulo: hay
  // ciclos de importación (catálogos → esquema → catálogos) y una constante
  // todavía no inicializada no puede leerse desde aquí arriba.
  return (issue) =>
    issue === "inactiva" ? (inactive ?? INACTIVE_ACCOUNT_MESSAGE) : general;
}

/** El mensaje de siempre cuando el rol no llega. */
const DEFAULT_DENY_MESSAGE =
  "No tienes permisos para esta acción. Revisa la configuración de tu rol con el administrador.";

interface DenialTrace {
  denyMessage?: string | ((actor: Doc<"users"> | null) => string);
}

/** El aviso que se le enseña a quien se queda fuera. */
function denialMessage(
  config: DenialTrace,
  actor: Doc<"users"> | null,
  message?: string,
): string {
  if (message) return message;
  const denyMessage = config.denyMessage;
  if (typeof denyMessage === "function") return denyMessage(actor);
  return denyMessage ?? DEFAULT_DENY_MESSAGE;
}

/**
 * Envuelve el manejador de una mutación con la comprobación de identidad, de
 * capacidad y de la política de la ficha. Los validadores se pasan aparte para
 * que los tipos de `args` en el manejador sean exactamente los de la mutación
 * que lo monta.
 */
export function secureMutation<T extends PropertyValidators, R>(
  config: SecureMutationConfig<T>,
  _validators: T,
  handler: (
    ctx: MutationCtx,
    args: ObjectType<T>,
    actor: Doc<"users">,
  ) => Promise<R>,
): (ctx: MutationCtx, args: ObjectType<T>) => Promise<R> {
  return async (ctx, args) => {
    const { user: actor, issue } = await memberStatus(ctx);
    if (actor === null || issue !== null) {
      // El aviso de identidad puede depender del motivo: un invitado no lee lo
      // mismo que quien no ha entrado, y una cuenta de baja tiene su propio
      // texto en los módulos que ya lo distinguían.
      const identity =
        typeof config.identityMessage === "function"
          ? config.identityMessage(issue ?? "sin_sesion")
          : config.identityMessage;
      throw new ConvexError(denialMessage(config, actor, identity));
    }

    const required = config.capability
      ? [config.capability]
      : config.capabilities
        ? [...config.capabilities]
        : [];

    if (required.length > 0) {
      const allowed =
        required.length === 1
          ? await hasCapability(ctx, actor, required[0])
          : await hasAnyCapability(ctx, actor, required);
      if (!allowed) {
        throw new ConvexError(denialMessage(config, actor));
      }
    }

    if (config.authorize) {
      const denial = await config.authorize(ctx, actor, args);
      if (denial !== null) {
        throw new ConvexError(denialMessage(config, actor, denial));
      }
    }

    return await handler(ctx, args, actor);
  };
}
