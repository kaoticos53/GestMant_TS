# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-PERMISSIONS-VIEW`
- **Objetivo:** Fase 3 - Reensamblado de `PermissionsView.tsx` como orquestador limpio y desacoplado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/PermissionsView.tsx`

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

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reensamblar `PermissionsView.tsx`.
- [x] **Paso 2:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 3:** Ejecutar tests con `npx vitest run tests/permissionsMatrixHook.test.ts tests/permissionsDraft.test.ts tests/permissions.test.ts`.
- [x] **Paso 4:** Commit atómico de Fase 3.
