# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-ASSOCIATE-DIALOG`
- **Objetivo:** Fase 3 - Extraer hook personalizado `useAssociateState` y reensamblar `AssociateDialog.tsx` como componente orquestador limpio (~122 líneas).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/associate/hooks/useAssociateState.ts`
  - `src/pages/dashboard/requests/dialogs/AssociateDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/dialogs/associate/hooks/useAssociateState.ts`: Custom hook que encapsula consultas Convex, mutaciones, estado y validación.
- [x] `src/pages/dashboard/requests/dialogs/AssociateDialog.tsx`: Reducido de 474 a 122 líneas (-74%), integrando subcomponentes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 3. Lista para commit.























