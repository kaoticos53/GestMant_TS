/**
 * Las reglas de «quién puede hacer qué» del taller, como código puro.
 *
 * Hasta ahora cada vista y cada mutación decidían con booleanos sueltos
 * (`canManage`, `can("manageIncidents")`) y, cuando importaba de quién era la
 * ficha, con comparaciones a mano. Eso funciona hasta que hay dos sitios que
 * tienen que contestar lo mismo de forma distinta. Aquí las reglas viven una
 * sola vez y se evalúan con CASL, que entiende de **capacidades** (qué puede
 * hacer un rol) y de **atributos** (sobre qué ficha concreta).
 *
 * Este archivo no sabe de React ni de Convex a propósito (`tests/arquitectura`
 * lo vigila): recibe quién es la persona y qué le han concedido, y devuelve un
 * motor con el que preguntar. El backend lo usa para decidir mutaciones
 * (`convex/_auth/secureMutation`) y la interfaz para esconder lo que no se
 * puede hacer (`components/AbilityProvider`), así que las dos caras contestan
 * con las mismas reglas.
 *
 * Las capacidades siguen siendo las de `lib/permissions`: lo que el
 * administrador reparte desde su pantalla no cambia. Lo que se añade es la
 * propiedad y el contexto —una incidencia cerrada no se retoca, el técnico
 * trabaja lo que tiene asignado— y una traza cuando alguien intenta lo que no
 * puede.
 *
 * Lo que **no** se añade es la máquina de estados. Qué paso cabe en cada estado
 * lo contestan `lib/incidentFlow`, `lib/requestFlow` y `lib/purchaseFlow`; si se
 * copiara aquí como condición de una regla, la regla y la máquina podrían
 * separarse y la ficha ofrecería lo que el servidor rechaza. CASL responde
 * «¿puede esta persona tramitar esta ficha?»; el estado, quien lo mira.
 */

import {
  AbilityBuilder,
  createMongoAbility,
  subject,
  type MongoAbility,
} from "@casl/ability";
import type { Capability } from "./permissions";
import { isAdmin, type RoleKey } from "./roles";

/** Las acciones del taller, en el vocabulario de las fichas. */
export type AppAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "decide"
  | "assign"
  | "verify"
  | "close"
  | "receive"
  | "cancel"
  | "reserve"
  | "archive"
  | "manage";

/** Sobre qué se actúa: los módulos y las fichas del taller. */
export type AppSubjectName =
  | "Incident"
  | "Request"
  | "PurchaseRequest"
  | "PurchaseOrder"
  | "InventoryItem"
  | "Equipment"
  | "Manual"
  | "Message"
  | "User"
  | "Role"
  | "Audit"
  | "all";

/**
 * El motor. Los sujetos son los nombres del taller y, además, una ficha
 * cualquiera: CASL solo admite condiciones (`{ assigneeId: … }`) cuando el tipo
 * de sujeto puede llevarlas, y un nombre suelto no puede. Con esa pieza en la
 * unión, las reglas por atributo se declaran con tipos y la comprobación sobre
 * una ficha concreta sigue siendo la misma llamada.
 */
export type AppAbility = MongoAbility<
  [AppAction, AppSubjectName | Record<string, unknown>]
>;

/** Quién pregunta: lo justo para decidir, sin arrastrar el documento de Convex. */
export interface AbilityActor {
  id: string;
  role: RoleKey;
  active?: boolean;
  isAnonymous?: boolean;
}

/** Lo que el administrador ha concedido a ese rol (`myPermissions().grants`). */
export type AbilityGrants = Partial<Record<Capability, boolean>>;

/**
 * Estados en los que una incidencia ya es historia: `resolved` o `unresolved`.
 * Se repiten aquí como datos de una condición de CASL; el flujo que decide las
 * transiciones sigue siendo `lib/incidentFlow` (`isClosedIncident`).
 */
const CLOSED_INCIDENT_STATUSES = ["resolved", "unresolved"] as const;

/**
 * El motor de permisos de una persona.
 *
 * Un invitado o una cuenta de baja no puede nada: ni siquiera mirar. El
 * administrador puede con todo, salvo lo que el propio sistema declara
 * inmutable —el rastro de seguridad y una incidencia ya cerrada—. El resto de
 * roles se dibuja desde las capacidades concedidas: son las mismas casillas que
 * la pantalla de permisos enseña, así que lo que allí se marca es lo que aquí
 * se permite, sin una segunda lista que mantener.
 */
export function defineAbilityFor(
  actor: AbilityActor | null,
  grants: AbilityGrants = {},
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility,
  );

  if (!actor || actor.active === false || actor.isAnonymous === true) {
    return build();
  }

  const allowed = (capability: Capability) => grants[capability] === true;
  const isTechnician = actor.role === "technician";

  if (isAdmin(actor.role)) {
    can("manage", "all");
    // Ni el administrador reabre lo cerrado ni borra la traza de seguridad.
    cannot(["update", "close", "assign", "verify"], "Incident", {
      status: { $in: [...CLOSED_INCIDENT_STATUSES] },
    });
    cannot("delete", "Audit");
    return build();
  }

  // Incidencias: ver la cola no es tocarla; gestionarla es trabajar cualquiera.
  if (allowed("viewIncidents")) can("view", "Incident");
  if (allowed("manageIncidents")) {
    can(
      ["create", "update", "assign", "verify", "close", "archive", "delete"],
      "Incident",
    );
  }

  // Peticiones: ver la cola no es tramitarla. Quien la tramita decide, corrige
  // lo que aún espera, archiva y retira. **Qué paso cabe en cada estado no se
  // responde aquí**: eso es la máquina (`lib/requestFlow`, `canRequestStep`), y
  // repetirla como condición de CASL la dejaría dicha dos veces y distinta.
  if (allowed("viewRequests")) can("view", "Request");
  if (allowed("createRequests")) can("create", "Request");
  if (allowed("decideRequests")) {
    can(["decide", "update", "archive", "delete"], "Request");
  }

  // Compras, almacén, equipos y manuales: ver y modificar son casillas aparte.
  if (allowed("viewPurchasing")) {
    can("view", "PurchaseOrder");
    can("view", "PurchaseRequest");
  }
  if (allowed("managePurchasing")) {
    can(["create", "update", "decide", "receive", "cancel"], "PurchaseOrder");
    // La cola de compras: a una petición de compra se le corrige la nota y el
    // proveedor, y retirarla es el paso `cancel` de `lib/purchaseFlow` —el que
    // la deja fuera de la compra—.
    can(["update", "cancel"], "PurchaseRequest");
    // Apartar lo que el almacén no cubre nace en una **petición de repuesto**
    // —el sujeto es esa ficha, no la compra—, y el paso se llama `reserve`.
    can("reserve", "Request");
  }
  if (allowed("viewInventory")) can("view", "InventoryItem");
  if (allowed("manageInventory")) {
    can(["create", "update", "delete"], "InventoryItem");
  }
  if (allowed("viewEquipment")) can("view", "Equipment");
  if (allowed("manageEquipment")) {
    can(["create", "update", "delete"], "Equipment");
  }
  if (allowed("viewManuals")) can("view", "Manual");
  if (allowed("manageManuals")) can(["create", "update", "delete"], "Manual");

  if (allowed("sendMessages")) can("create", "Message");
  if (allowed("manageUsers")) can(["view", "update"], "User");
  if (allowed("configurePermissions")) can("manage", "Role");
  if (allowed("viewAudit")) can("view", "Audit");

  // Propiedad: el técnico trabaja lo que tiene asignado —en la cola o en el
  // taller—, aunque su rol no pueda tocar las incidencias de los demás.
  if (isTechnician) {
    can(["update", "close"], "Incident", { assigneeId: actor.id });
    can(["update", "close"], "Incident", { workshopAssigneeId: actor.id });
  }

  // Y lo cerrado no se retoca, tenga quien tenga la capacidad.
  cannot(["update", "close", "assign", "verify"], "Incident", {
    status: { $in: [...CLOSED_INCIDENT_STATUSES] },
  });
  // La trazabilidad de seguridad es inmutable, también para el administrador.
  cannot("delete", "Audit");

  return build();
}

/** El motor vacío: el de una sesión que no puede nada (invitado). */
export function emptyAbility(): AppAbility {
  return defineAbilityFor(null);
}

/**
 * Comprueba una acción sobre una ficha concreta, con sus atributos.
 *
 * CASL necesita saber de qué tipo es el objeto para aplicar las condiciones del
 * rol, y un objeto suelto no lo lleva escrito: `subject()` se lo pone. Solo se
 * usa aquí, para que ninguna vista tenga que acordarse de hacerlo.
 */
export function allowsOn(
  ability: AppAbility,
  action: AppAction,
  subjectName: Exclude<AppSubjectName, "all">,
  resource: Record<string, unknown>,
): boolean {
  return ability.can(
    action,
    subject(subjectName, resource) as unknown as AppSubjectName,
  );
}

/**
 * La ficha de una incidencia, marcada como tal para la interfaz (`<Can>`).
 * Sin la marca, CASL no sabría que ese objeto es una incidencia y las reglas
 * por atributo no se aplicarían.
 */
export function asIncident(incident: Record<string, unknown>) {
  return subject("Incident", incident);
}

/** La ficha de una petición, marcada como tal para la interfaz (`<Can>`). */
export function asRequest(request: Record<string, unknown>) {
  return subject("Request", request);
}

/** La orden de compra, marcada como tal para la interfaz (`<Can>`). */
export function asPurchaseOrder(order: Record<string, unknown>) {
  return subject("PurchaseOrder", order);
}

/**
 * La petición de compra —la fila de la cola, ya apartada— marcada para
 * preguntar por ella. No es una petición de repuesto: la de repuesto la pide el
 * taller y esta la compra el módulo de compras.
 */
export function asPurchaseRequest(request: Record<string, unknown>) {
  return subject("PurchaseRequest", request);
}
