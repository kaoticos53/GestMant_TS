# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** SEC-FASE-4: Trazabilidad, Auditoría y Prevención de Fugas de Información
- **Objetivo:** Extender la auditoría con `securityAuditLog` y el helper `logSecurityEvent`, registrar cambios de rol en `members.setRole`, activación/bajas en `members.setActive`, vaciado de taller en `workshopReset`, proteger credenciales en scripts NAS y agregar tests automatizados en `tests/audit.test.ts`.
- **Módulo(s) Afectado(s):** `src/convex/schema.ts`, `src/convex/audit.ts`, `src/convex/members.ts`, `src/convex/workshopReset.ts`, `scripts/nas-backup.mjs`, `scripts/nas-setup.mjs`, `tests/audit.test.ts`.

---

## 2. Archivos a Modificar / Crear
- [x] `src/convex/schema.ts`: Definir la tabla inmutable `securityAuditLog`.
- [x] `src/convex/audit.ts`: Crear el módulo backend con `logSecurityEvent` y la query protegida `securityAuditLogs`.
- [x] `src/convex/members.ts`: Registrar eventos de auditoría en `setRole` y en cambios de activación/baja.
- [x] `src/convex/workshopReset.ts`: Registrar evento de auditoría en `resetWorkshop`.
- [x] `scripts/nas-backup.mjs` y `scripts/nas-setup.mjs`: Añadir sanitización para prevenir fugas de contraseñas/secretos en salida de error.
- [x] `tests/audit.test.ts`: Agregar pruebas que verifiquen el registro inmutable de auditoría ante cambios de roles.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No importa convex ni react en `src/lib/`.
- [x] ¿Modifica estados o transiciones? No modifica máquinas de estado.
- [x] ¿Introduce términos nuevos? Respeta el vocabulario de `GLOSARIO.md`.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Planificar e implementar cambios mínimos.
- [x] **Paso 2:** Ejecutar comprobación de tipos: `npx tsc --noEmit`.
- [x] **Paso 3:** Ejecutar test unitario del módulo: `npx vitest run tests/audit.test.ts`.
- [x] **Paso 4:** Ejecutar test de arquitectura: `npx vitest run tests/arquitectura.test.ts`.
- [x] **Paso 5:** Completar el resumen de sesión en `.context/session-state-template.md`.
