# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-COMPATIBLE-MODELS-SECTION`
- **Objetivo:** Fase 3 - Orquestar `CompatibleModelsSection.tsx` delegando en `useCompatibleModels`, `CompatibleModelsSearchResults`, `CreateNewModelButton` y `CompatibleModelsBadgeList`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/components/CompatibleModelsSection.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `compatibleModels/types.ts`: contratos de tipos para modelos, props y callbacks.
- [x] `compatibleModels/helpers.ts`: funciones puras de resolución de mapas, búsqueda con matchesQuery y chequeo de coincidencia exacta.
- [x] `tests/compatibleModelsSectionHelpers.test.ts`: suite de 14 pruebas unitarias para helpers.
- [x] `compatibleModels/useCompatibleModels.ts`: hook de búsqueda y alta al vuelo.
- [x] `compatibleModels/components/CompatibleModelsSearchResults.tsx`: lista accesible de resultados.
- [x] `compatibleModels/components/CreateNewModelButton.tsx`: botón para alta al vuelo con icono Sparkles.
- [x] `compatibleModels/components/CompatibleModelsBadgeList.tsx`: lista de badges con botón X.
- [x] `compatibleModels/index.ts`: barril unificado.
- [x] `inventory/components/CompatibleModelsSection.tsx`: orquestador modular completado (~80 líneas).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada - Commit atómico 3 listo.





