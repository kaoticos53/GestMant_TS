# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-USERS-VIEW-CIERRE`
- **Objetivo:** Fase 4 - Validación integral, build de producción y cierre de refactorización arquitectónica de `UsersView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/UsersView.tsx`
  - `src/pages/dashboard/users/types.ts`
  - `src/pages/dashboard/users/hooks/useUsersOperations.ts`
  - `src/pages/dashboard/users/hooks/useCreateUserForm.ts`
  - `src/pages/dashboard/users/hooks/useEditUserForm.ts`
  - `src/pages/dashboard/users/components/UsersHeader.tsx`
  - `src/pages/dashboard/users/components/UserTableRow.tsx`
  - `src/pages/dashboard/users/dialogs/CreateUserDialog.tsx`
  - `src/pages/dashboard/users/dialogs/EditUserDialog.tsx`
  - `src/pages/dashboard/users/dialogs/DeactivateDialog.tsx`
  - `tests/usersHooks.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/users/types.ts`: Proyección `Member` y opciones de rol.
- [x] `src/pages/dashboard/users/hooks/useUsersOperations.ts`: Hook central de mutaciones de rol, baja y reactivación.
- [x] `src/pages/dashboard/users/hooks/useCreateUserForm.ts`: Hook y validador puro `validateCreateUserData`.
- [x] `src/pages/dashboard/users/hooks/useEditUserForm.ts`: Hook y validador puro `validateEditUserData` con persistencia en catálogos.
- [x] `src/pages/dashboard/users/components/UsersHeader.tsx`: Cabecera de la vista con título y acción de alta.
- [x] `src/pages/dashboard/users/components/UserTableRow.tsx`: Fila memoizada con selector de rol y badges.
- [x] `src/pages/dashboard/users/dialogs/CreateUserDialog.tsx`: Modal desacoplado de alta de usuarios.
- [x] `src/pages/dashboard/users/dialogs/EditUserDialog.tsx`: Modal desacoplado de edición de perfiles.
- [x] `src/pages/dashboard/users/dialogs/DeactivateDialog.tsx`: Modal desacoplado de revocación de acceso.
- [x] `src/pages/dashboard/UsersView.tsx`: Orquestador reducido de 764 a 207 líneas.
- [x] `tests/usersHooks.test.ts`: Pruebas unitarias para validadores y estructura de tipos.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas (`tests/arquitectura.test.ts` y `tests/seguridad.test.ts` 100% verdes).
- [x] ¿Build de producción? Verificada con `npm run build` en 5.17s.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Verificación de tipos estricta (`npx tsc -b`).
- [x] **Paso 2:** Verificación de guardrails de arquitectura (`tests/arquitectura.test.ts`).
- [x] **Paso 3:** Verificación de guardrails de seguridad (`tests/seguridad.test.ts`).
- [x] **Paso 4:** Suite completa de tests (`1894 passed`, 0 fallos).
- [x] **Paso 5:** Compilación de producción exitosa (`npm run build`).
- [x] **Paso 6:** Commit atómico de Fase 4 y cierre.
