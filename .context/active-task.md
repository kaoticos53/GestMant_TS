# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-WORKSHOP-DATA-CARD`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `WorkshopDataCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/WorkshopDataCard.tsx`
  - `src/pages/dashboard/settings/workshopData/`
  - `tests/workshopDataCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `workshopData/types.ts`: contratos de tipos e interfaces.
- [x] `workshopData/helpers.ts`: helpers de confirmación ("VACIAR") y formateo de resúmenes de seed/reset.
- [x] `tests/workshopDataCardHelpers.test.ts`: suite de tests unitarios verificando la lógica pura (11 tests).
- [x] `workshopData/hooks/useWorkshopDataActions.ts`: hook con actions/mutations de Convex y estados de carga.
- [x] `workshopData/components/WorkshopDataHeader.tsx`: cabecera explicativa con icono Database.
- [x] `workshopData/components/WorkshopDataActions.tsx`: botones de carga de datos y vaciado.
- [x] `workshopData/components/WorkshopResetDialog.tsx`: diálogo modal de confirmación con input VACIAR.
- [x] `workshopData/index.ts`: barril unificado.
- [x] `WorkshopDataCard.tsx`: reducción de 223 a 47 líneas orquestando limpiamente los componentes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.393 tests pasados en 201 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Taller, repuestos, compras, incidencias, peticiones).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
