# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PURCHASING-HISTORY-SELECTION-EXPORT`
- **Objetivo:** Fase 1 - Extracción de `useCellSelection.ts` y `useHistoryExport.ts` en `src/pages/dashboard/purchasing/hooks/`, pruebas unitarias en `tests/purchasingHistorySelection.test.ts` e integración inicial.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/hooks/useCellSelection.ts`
  - `src/pages/dashboard/purchasing/hooks/useHistoryExport.ts`
  - `tests/purchasingHistorySelection.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/purchasing/hooks/useCellSelection.ts`: Gestión de selección matricial bidimensional (`Set<string>`) tipo hoja de cálculo.
- [x] `src/pages/dashboard/purchasing/hooks/useHistoryExport.ts`: Abstracción de copiado TSV al portapapeles y descarga de archivo CSV.
- [x] `tests/purchasingHistorySelection.test.tsx`: Pruebas de selección de celdas, filas y tabla completa.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `useCellSelection.ts`.
- [x] **Paso 2:** Crear `useHistoryExport.ts`.
- [x] **Paso 3:** Crear `tests/purchasingHistorySelection.test.tsx`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 5:** Commit atómico de la Fase 1.
