# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-COMPATIBLE-MODELS-SECTION`
- **Objetivo:** Fase 1 - Crear `types.ts`, `helpers.ts` y suite de pruebas unitarias `tests/compatibleModelsSectionHelpers.test.ts` para `CompatibleModelsSection.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/inventory/components/compatibleModels/types.ts`
  - `src/pages/dashboard/inventory/components/compatibleModels/helpers.ts`
  - `tests/compatibleModelsSectionHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `compatibleModels/types.ts`: contratos de tipos para modelos, props y callbacks.
- [x] `compatibleModels/helpers.ts`: funciones puras de resolución de mapas, búsqueda con matchesQuery y chequeo de coincidencia exacta.
- [x] `tests/compatibleModelsSectionHelpers.test.ts`: suite de 14 pruebas unitarias para helpers.
- [ ] `compatibleModels/useCompatibleModels.ts`: pendiente Fase 2.
- [ ] `compatibleModels/components/CompatibleModelsSearchResults.tsx`: pendiente Fase 2.
- [ ] `compatibleModels/components/CreateNewModelButton.tsx`: pendiente Fase 2.
- [ ] `compatibleModels/components/CompatibleModelsBadgeList.tsx`: pendiente Fase 2.
- [ ] `compatibleModels/index.ts`: pendiente Fase 2.
- [ ] `inventory/components/CompatibleModelsSection.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? 14 tests de helpers y arquitectura aprobados.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada - Commit atómico 1 listo.

