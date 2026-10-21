# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `FASE3-ESCALABILIDAD-BACKEND-CONCURRENCIA`
- **Objetivo:** Garantizar escalabilidad backend, soporte de grandes volúmenes con paginación por cursor en Convex (`spareParts`, `incidents`, `purchasing`), offloading de compresión multimedia a Web Workers nativos (`src/workers/compress.worker.ts`) y control de concurrencia optimista (`assertIncidentNotModified`).
- **Módulo(s) Afectado(s):** Backend Convex (`spareParts.ts`, `incidents.ts`, `purchasing.ts`), Lib (`imageCompress.ts`), Workers (`src/workers/compress.worker.ts`), Tests (`incidentConcurrency.test.ts`, `pagination.test.ts`, `compressWorker.test.ts`).

---

## 2. Archivos a Modificar / Crear
- [x] `src/convex/spareParts.ts`: Query `paginatedList` con `paginationOptsValidator`.
- [x] `src/convex/incidents.ts`: Query `paginatedList` con `paginationOptsValidator` y filtros de borrado.
- [x] `src/convex/_purchasing/queries.ts` & `src/convex/purchasing.ts`: Query `paginatedOrders` con `paginationOptsValidator`.
- [x] `src/workers/compress.worker.ts`: Worker nativo para compresión y reescalado de imágenes en hilo secundario.
- [x] `src/lib/imageCompress.ts`: Integración de delegación al Worker con fallback suave al hilo principal.
- [x] `tests/pagination.test.ts`: Tests de paginación por cursor (3/3 pasados).
- [x] `tests/compressWorker.test.ts`: Tests de compresión con degradación suave (2/2 pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? `imageCompress.ts` no importa React ni Convex; 100% puro verificado por `tests/arquitectura.test.ts`.
- [x] ¿Modifica estados o transiciones de dominio? No.
- [x] ¿Introduce términos prohibidos en el vocabulario ubicuo? No.
- [x] ¿Seguridad en Convex? Sí, todas las queries paginadas verifican identidad y capacidades.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Implementación de Optimistic Locking (Tarea 3.1 comiteada).
- [x] **Paso 2:** Queries paginadas con cursor en Convex (Tarea 3.2).
- [x] **Paso 3:** Offloading de compresión a Web Worker (Tarea 3.3).
- [x] **Paso 4:** Verificación estricta de tipos (`npx tsc --noEmit` -> 0 errores).
- [x] **Paso 5:** Suites de pruebas (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`, `tests/pagination.test.ts`, `tests/compressWorker.test.ts`).
- [x] **Paso 6:** Commit de la Fase 3 y continuación con la Fase 4.







