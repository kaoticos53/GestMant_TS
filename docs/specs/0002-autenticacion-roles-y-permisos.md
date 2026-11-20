# SPEC-0002 — Autenticación, Roles y Permisos (RBAC + CASL)

- **ID:** `SPEC-0002`
- **Título:** Autenticación, sesiones, gestión de usuarios, roles y control de acceso CASL
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/auth.ts`, `src/convex/auth/emailOtp.ts`, `src/convex/members.ts`, `src/convex/permissions.ts`, `src/convex/_auth/secureMutation.ts`, `src/lib/permissions.ts`, `src/lib/abilities.ts`, `src/lib/roles.ts`, `src/components/RequireAuth.tsx`, `src/components/AbilityProvider.tsx`, `src/pages/Auth.tsx`, `src/pages/dashboard/UsersView.tsx`

---

## 1. Contexto y Objetivos

Controla el acceso al taller mediante `@convex-dev/auth` (contraseña, OTP por correo y sesiones anónimas de invitado para seguimiento) y aplica autorización granular por capacidades (**19 capacidades** agrupadas en **roles de sistema** y **roles personalizados**) tanto en la interfaz (**CASL**) como en cada mutación del backend (`secureMutation`).

- **En alcance:** Alta/edición/baja lógica de usuarios, revocación de sesiones, matriz de permisos por rol, promoción inicial por `INITIAL_ADMIN_EMAIL`, protección de rutas y componentes.
- **Fuera de alcance:** Reto humano en `/reportar` (`SPEC-0003`) y permisos específicos de herramientas IA (`SPEC-0012`).

---

## 2. Modelo de Dominio

- **Roles de sistema (`src/lib/roles.ts`):** `admin` (todas las capacidades bloqueadas), `manager` (responsable de repuestos), `technician` (técnico), `guest` (invitado anónimo sin acceso al panel).
- **Roles personalizados (`roles` table):** creados por el administrador con `kind: "custom"`, `key` slugificado único, `label`, `description` y mapa `grants: Record<Capability, boolean>`.
- **Capacidades (`src/lib/permissions.ts`):** `viewIncidents`, `manageIncidents`, `viewRequests`, `createRequests`, `lookupCatalog`, `decideRequests`, `viewPurchasing`, `managePurchasing`, `viewInventory`, `manageInventory`, `viewEquipment`, `manageEquipment`, `lookupEquipment`, `viewManuals`, `manageManuals`, `sendMessages`, `manageUsers`, `configurePermissions`, `viewAudit`.

---

## 3. Requisitos Funcionales

- **RF-001 (Proveedores de acceso):** `src/convex/auth.ts` soporta inicio de sesión con contraseña, código OTP por correo (`emailOtp.ts`) con límite en `otpSendLimits` (`otpLimits.ts`) y acceso anónimo de invitado para seguimiento público.
- **RF-002 (Guardas de mutación `secureMutation`):** Toda mutación pública autenticada valida sesión activa no anónima (`memberStatus`), comprueba la capacidad requerida en `grantsForRole` y valida argumentos antes de ejecutar el handler.
- **RF-003 (Gestión de usuarios `members.ts`):** El administrador puede crear usuarios (`createUser`), actualizar datos (`updateUser`), activar/desactivar cuentas (`setActive`), cambiar rol (`setRole`) y revocar sesiones activas (`revokeSessions`). Los usuarios pueden editar su propio perfil (`updateProfile`).
- **RF-004 (Matriz de permisos `permissions.ts`):** `myPermissions` expone los grants efectivos al cliente; `setRolePermissions`, `createRole`, `updateRole` y `deleteRole` permiten gestionar roles desde la UI registrando auditoría.
- **RF-005 (Promoción de administrador inicial):** `ensureRole` promociona a `admin` únicamente si coincide con `INITIAL_ADMIN_EMAIL` (prohibido hardcodear correos literales, verificado por `tests/seguridad.test.ts`).

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** El rol `admin` conserva siempre todas las capacidades (`locked: true` en `manageUsers`, `configurePermissions`, `viewAudit`); nunca se pueden revocar.
- **RN-002:** Un usuario desactivado (`active === false`) o anónimo (`isAnonymous === true`) es rechazado en cualquier consulta o mutación interna del panel.
- **RN-003:** No se puede eliminar un rol del sistema ni un rol que tenga usuarios asignados.

---

## 5. Permisos y Seguridad

- `manageUsers` protege `members.createUser`, `members.updateUser`, `members.setActive`, `members.setRole`, `members.revokeSessions`.
- `configurePermissions` protege `permissions.setRolePermissions`, `createRole`, `updateRole`, `deleteRole`.
- Eventos críticos (`role_change`, `user_status_change`, `permission_change`, `session_revoke`, `login_fail`) se registran en `securityAuditLog` (`SPEC-0013`).

---

## 6. Requisitos No Funcionales

- **RNF-001:** La evaluación CASL en cliente (`AbilityProvider`) y la verificación en servidor (`grantsForRole`) comparten exactamente el mismo catálogo `CAPABILITIES` y `DEFAULT_GRANTS` en `src/lib/permissions.ts`.

---

## 7. Interfaz de Usuario

- `/auth` (`Auth.tsx`): pestañas de inicio de sesión, recuperación/OTP y creación de cuenta cuando procede.
- `RequireAuth.tsx` y `AbilityProvider.tsx`: bloquean vistas privadas a invitados o sin sesión.
- `UsersView.tsx`: listado de usuarios, matriz de permisos, alta/edición/desactivación de cuentas y revocación de sesiones.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Bloqueo de mutación sin permiso**
  - **Dado** un usuario autenticado con rol `technician` sin capacidad `manageInventory`
  - **Cuando** invoca una mutación protegida por `manageInventory`
  - **Entonces** `secureMutation` lanza `ConvexError` denegando la operación

- **CA-002 — Cuenta desactivada rechazada**
  - **Dado** un usuario marcado con `active: false`
  - **Cuando** intenta acceder al dashboard o ejecutar cualquier query/mutation privada
  - **Entonces** el backend rechaza la petición indicando que la cuenta está dada de baja

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001, RF-005 | Acceso, OTP y admin inicial | `tests/authHelpers.test.ts`, `tests/sessionSecurity.test.ts`, `tests/seguridad.test.ts` |
| RF-002, CA-001 | Guardas de mutación | `tests/secureMutation.test.ts`, `tests/permissions.test.ts` |
| RF-003, CA-002 | Usuarios, bajas y perfiles | `tests/usersHelpers.test.ts`, `tests/usersHooks.test.ts`, `tests/profiles.test.ts` |
| RF-004, RN-001 | Roles personalizados y CASL | `tests/abilities.test.ts`, `tests/roles.test.ts`, `tests/customRoles.test.ts`, `tests/permissionsDraft.test.ts`, `tests/permissionsMatrixHook.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna crítica detectada; los roles personalizados dependen de `roles.grants` y hacen fail-closed ante claves huérfanas.
