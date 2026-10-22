# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-INCIDENT-PART-REQUESTS-CARD`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `IncidentPartRequestsCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentPartRequestsCard.tsx`
  - `src/pages/dashboard/incidents/components/detail/partRequests/`
  - `tests/incidentPartRequestsCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partRequests/types.ts`: contratos de props para `IncidentPartRequestsCard`, `IncidentPartRequestItem` e `IncidentPartRequestLine`.
- [x] `partRequests/helpers.ts`: funciones puras de etiquetas de entrega, metadatos y cálculo de líneas.
- [x] `tests/incidentPartRequestsCardHelpers.test.ts`: 5 tests unitarios verificando estados de material y líneas.
- [x] `partRequests/IncidentPartRequestLine.tsx`: componente atómico para la línea de repuesto.
- [x] `partRequests/IncidentPartRequestItem.tsx`: ficha individual de la petición con cabecera y metadatos.
- [x] `partRequests/index.ts`: barril unificado para el submódulo partRequests.
- [x] `IncidentPartRequestsCard.tsx`: reducción de 222 a 42 líneas orquestando limpiamente los componentes.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.382 tests pasados en 200 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Petición de repuesto, Incidencia).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
