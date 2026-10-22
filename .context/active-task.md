# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-GLOBAL-SEARCH`
- **Objetivo:** Fase 3 - Extraer custom hook `useGlobalSearch` y reensamblar `GlobalSearch.tsx` como componente orquestador limpio (~73 líneas).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/search/hooks/useGlobalSearch.ts`
  - `src/pages/dashboard/GlobalSearch.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/search/hooks/useGlobalSearch.ts`: Custom hook que encapsula lazy queries Convex, listeners de Ctrl+K y click externo, navegación por teclado y selección.
- [x] `src/pages/dashboard/GlobalSearch.tsx`: Reducido de 480 a 73 líneas (-84.8%), integrando subcomponentes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 3. Lista para commit.























