# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `SEC-FASE1-CSV-INJECTION-ANTI-BRUTEFORCE`
- **Objetivo:** Remediación de vulnerabilidades de severidad alta: neutralización de CSV Formula Injection (CWE-1236) en exportaciones de datos y blindaje de la consulta pública de incidencias contra fuerza bruta masiva distribuida (CWE-307).
- **Módulo(s) Afectado(s):** `src/lib/export.ts`, `src/lib/purchasing.ts`, `src/convex/publicLookupLimits.ts`, `tests/csvSecurity.test.ts`.

---

## 2. Archivos a Modificar / Crear
- [x] `src/lib/export.ts`: Neutralizar celdas que inicien por `=+\-@\t\r` prefijándolas con `'`.
- [x] `src/lib/purchasing.ts`: Neutralizar celdas en `historyRowsToCsv`.
- [x] `src/convex/publicLookupLimits.ts`: Implementar cupo global horario de consultas no coincidentes.
- [x] `src/lib/publicLookup.ts`: Constante `GLOBAL_LOOKUP_LIMIT_PER_HOUR` y helper `admitGlobalLookup`.
- [x] `tests/csvSecurity.test.ts`: Test unitario de neutralización de fórmulas CSV (4/4 pasados).
- [x] `tests/publicLookupSecurity.test.ts`: Test de cupo global anti-fuerza bruta (2/2 pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? Sí, `src/lib/export.ts` y `purchasing.ts`. Prohibido importar React o Convex en `src/lib/`. (Verificado 0 imports).
- [x] ¿TypeScript estricto? Cero `any`. (Verificado `npx tsc --noEmit` -> 0 errores).
- [x] ¿Seguridad en Convex? Sí, preserva la identidad y control de acceso.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Neutralizar fórmulas en `src/lib/export.ts` (`escapeCsvCell`).
- [x] **Paso 2:** Neutralizar fórmulas en `src/lib/purchasing.ts` (`historyRowsToCsv`).
- [x] **Paso 3:** Implementar límite global horario en `src/convex/publicLookupLimits.ts`.
- [x] **Paso 4:** Crear tests unitarios `tests/csvSecurity.test.ts` y `tests/publicLookupSecurity.test.ts`.
- [x] **Paso 5:** Verificar tipos (`npx tsc --noEmit`) y tests (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`).
- [x] **Paso 6:** Commit de la Fase 1 y continuación con la Fase 2.
