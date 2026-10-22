# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-AUDIT-VIEW`
- **Objetivo:** Fase 4 - Validación integral, guardrails de seguridad/arquitectura, build de producción y cierre de refactorización de `AuditView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/AuditView.tsx`
  - Subcomponentes, hooks y tipos en `src/pages/dashboard/audit/`
  - Pruebas en `tests/auditEntriesLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/audit/types.ts`: Contratos de props y opciones de ordenación del rastro documental.
- [x] `src/pages/dashboard/audit/hooks/useAuditEntries.ts`: Custom hook con gestión de filtros, búsqueda, orden, paginación, agrupación y exportación CSV.
- [x] `tests/auditEntriesLogic.test.ts`: Pruebas unitarias para filtrado, búsqueda por texto, ordenación por fecha y generación de resumen (7 tests al 100%).
- [x] `src/pages/dashboard/audit/components/AuditHeaderCard.tsx`: Cabecera informativa con rango temporal y conteos.
- [x] `src/pages/dashboard/audit/components/AuditFiltersCard.tsx`: Panel con selectores por persona, tipo de movimiento, fechas, presets rápidos, reset y botón CSV.
- [x] `src/pages/dashboard/audit/components/AuditMovementRow.tsx`: Fila individual atómica con formato de acción, autor, enlace a incidencia, badges y hora.
- [x] `src/pages/dashboard/audit/components/AuditGroupSection.tsx`: Sección agrupada por jornada con cabecera sticky y lista.
- [x] `src/pages/dashboard/audit/components/AuditEmptyStates.tsx`: Skeletons de carga, estado sin movimientos del taller y estado sin coincidencias de filtros.
- [x] `src/pages/dashboard/AuditView.tsx`: Orquestador principal refactorizado, reducido de 553 a 123 líneas (~78% de reducción).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? 7 tests en verde (`tests/auditEntriesLogic.test.ts`).
- [x] ¿Suite completa? 156 suites y 1.962 tests pasando al 100% en Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Pasados al 100% (18/18 tests en `tests/arquitectura.test.ts` y `tests/seguridad.test.ts`).
- [x] ¿Build de producción Vite? Exitoso (`npm run build`).

---

## 4. Estado Final
- **Estado:** ✅ Completado y Verificado. Listo para commit atómico de cierre de Fase 4.
