# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-INCIDENT-EQUIPMENT-CARD`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `IncidentEquipmentCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/IncidentEquipmentCard.tsx`
  - `src/pages/dashboard/incidents/components/detail/equipment/`
  - `tests/incidentEquipmentCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `equipment/types.ts`: contratos de interfaz para subsecciones de equipo.
- [x] `equipment/helpers.ts`: helpers puros de cálculo y formato (SAT, moneda EUR, inventario).
- [x] `tests/incidentEquipmentCardHelpers.test.ts`: 12 tests unitarios con tipado estricto.
- [x] `equipment/IncidentNotificationSection.tsx`: datos de notificación, equipamiento y descripción.
- [x] `equipment/IncidentAssignmentSection.tsx`: asignación técnica, entrada a taller y notas.
- [x] `equipment/IncidentExternalRepairSection.tsx`: gestión de SAT y costes monetarios.
- [x] `equipment/index.ts`: barril unificado para el submódulo equipment.
- [x] `IncidentEquipmentCard.tsx`: reducción de 244 a 34 líneas, actuando como orquestador limpio.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.367 tests pasados en 197 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (5.25s).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Equipo, Incidencia, Técnico).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
