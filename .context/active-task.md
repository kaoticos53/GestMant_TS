# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-PERMISSIONS-VIEW`
- **Objetivo:** Fase 2 - Modularización de subcomponentes visuales (`RoleDialog`, `DeleteRoleDialog`, `PermissionsStats`, `PermissionsTable`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/permissions/components/RoleDialog.tsx`
  - `src/pages/dashboard/permissions/components/DeleteRoleDialog.tsx`
  - `src/pages/dashboard/permissions/components/PermissionsStats.tsx`
  - `src/pages/dashboard/permissions/components/PermissionsTable.tsx`

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

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Implementar `RoleDialog.tsx`.
- [x] **Paso 2:** Implementar `DeleteRoleDialog.tsx`.
- [x] **Paso 3:** Implementar `PermissionsStats.tsx`.
- [x] **Paso 4:** Implementar `PermissionsTable.tsx`.
- [x] **Paso 5:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 6:** Ejecutar tests con `npx vitest run tests/permissionsMatrixHook.test.ts tests/permissionsDraft.test.ts`.
- [x] **Paso 7:** Commit atómico de Fase 2.
