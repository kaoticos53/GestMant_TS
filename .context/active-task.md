# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-PERMISSIONS-VIEW`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `PermissionsView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/PermissionsView.tsx`
  - Subcomponentes y hooks en `src/pages/dashboard/permissions/`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/permissions/types.ts`: Tipos base (`RoleInfo`, `DialogState`, etc.).
- [x] `src/pages/dashboard/permissions/hooks/usePermissionsMatrix.ts`: Hook de control de borrador, guardado concurrente y dirtiness.
- [x] `src/pages/dashboard/permissions/hooks/useRoleManagement.ts`: Hook para gestión de modales y borrado accesible de roles.
- [x] `tests/permissionsMatrixHook.test.ts`: Pruebas unitarias de draft, guardado y cálculo de cambios (6 tests).
- [x] `src/pages/dashboard/permissions/components/RoleDialog.tsx`: Modal para alta, renombrado y duplicación de roles.
- [x] `src/pages/dashboard/permissions/components/DeleteRoleDialog.tsx`: Confirmación accesible de borrado con aviso de usuarios asignados.
- [x] `src/pages/dashboard/permissions/components/PermissionsStats.tsx`: Resumen cuantitativo de capacidades concedidas por rol.
- [x] `src/pages/dashboard/permissions/components/PermissionsTable.tsx`: Tabla matricial con columnas fijas y switches de permisos.
- [x] `src/pages/dashboard/PermissionsView.tsx`: Vista orquestadora limpia, reducida de 579 a 145 líneas (~75% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de módulo? 42 tests en verde (`tests/permissionsMatrixHook.test.ts`, `tests/permissionsDraft.test.ts`, `tests/permissions.test.ts`).
- [x] ¿Suite completa? 152 suites y 1.941 tests pasando en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
