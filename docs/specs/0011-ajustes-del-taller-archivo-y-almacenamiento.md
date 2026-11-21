# SPEC-0011 — Ajustes del Taller, Archivo, Papelera y Almacenamiento

- **ID:** `SPEC-0011`
- **Título:** Configuración del taller, catálogos, archivo automático, papelera, limpieza de almacén y vaciado
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/pages/dashboard/WorkshopSettingsView.tsx`, `src/pages/dashboard/settings/*`, `src/pages/dashboard/ArchiveView.tsx`, `src/convex/catalogs.ts`, `src/convex/archive.ts`, `src/convex/trash.ts`, `src/convex/storageCleanup.ts`, `src/convex/cleanupLog.ts`, `src/convex/seed.ts`, `src/convex/workshopReset.ts`

---

## 1. Contexto y Objetivos

Agrupa la administración operativa del taller: listas maestras (`catalogs`), modelos de equipos, audiencias de avisos, archivo automático y manual, papelera con retención configurable, limpieza de archivos huérfanos en `_storage`, configuración de IA (`SPEC-0012`) y carga/vaciado de datos del taller.

---

## 2. Modelo de Dominio

- **`catalogs`:** elementos de autocompletado por `kind` (`brand`, `equipmentLocation`, `position`, `supplier`, `manualType`, etc.).
- **`archiveSettings`, `storageSettings`:** días de retención antes de archivar (`runAutoArchive`) o purgar definitivamente.
- **`trashFiles`, `storageCleanupRuns`, `reportUploadPurges`:** inventario de archivos retirados y auditoría de ejecuciones de limpieza.

---

## 3. Requisitos Funcionales

- **RF-001 (Catálogos y normalización):** `catalogs.ts` ofrece lectura pública acotada (`listPublic` para `/reportar`), alta automática (`ensureItem`), edición, borrado, fusión de duplicados (`mergeDuplicates`) y migración de ubicaciones heredadas.
- **RF-002 (Archivo automático y manual):** `archive.runAutoArchive` (cron `03:15` UTC) archiva incidencias cerradas y peticiones decididas anteriores al umbral; `ArchiveView.tsx` permite consultar y recuperar fichas archivadas.
- **RF-003 (Papelera y retención):** Las incidencias, peticiones y archivos retirados permanecen recuperables hasta vencer el plazo de retención (`trash.purgeExpired`, `incidents.purgeExpired`, `partRequests.purgeExpired`).
- **RF-004 (Limpieza de almacenamiento):** `reportUploads.sweepUnused` (`04:00` UTC) y `storageCleanup.sweepOrphanFiles` (`04:30` UTC) eliminan ficheros no referenciados tras avisar (`03:45` UTC). La pasada lee todas las tablas, así que también respeta los adjuntos y el `.eml` de `mailShares` mientras una copia los cite, y los retira cuando la copia desaparece.
- **RF-005 (Vaciado y datos de muestra):** `seed.ts` carga datos de demostración; `workshopReset.ts` vacía `RESET_TABLES` exigiendo confirmación y permiso administrativo. El vaciado incluye `mailShares`: borra sus filas y deja los objetos a la limpieza nocturna, sin tocar `securityAuditLog`.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** `securityAuditLog` **NUNCA** se incluye en `RESET_TABLES` (`workshopReset.ts`).
- **RN-002:** La limpieza nocturna nunca borra un `storageId` citado en `incidents`, `incidentDocuments`, `partRequests`, `receptions`, `manuals` o `mailShares`.

---

## 5. Permisos y Seguridad

- Pestañas visibles en `WorkshopSettingsView.tsx` según capacidades: `catalogs` y `models` por defecto; `alerts`, `storage`, `mail`, `ai` y `data` según permisos de gestión/administración (`resolveDerivedPermissions`).

---

## 6. Requisitos No Funcionales

- **RNF-001:** Los crons de archivo y limpieza se ejecutan escalonadamente entre `03:15` y `05:30` UTC para evitar colisiones.

---

## 7. Interfaz de Usuario

- `WorkshopSettingsView.tsx` con 7 pestañas superiores (`catalogs`, `models`, `alerts`, `storage`, `mail`, `ai`, `data`).
- `ArchiveView.tsx`: listado de incidencias y peticiones archivadas o en papelera.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Preservación de `securityAuditLog` en el vaciado**
  - **Dado** un taller con registros en `securityAuditLog` y datos operativos
  - **Cuando** un administrador ejecuta `workshopReset`
  - **Entonces** se vacían las tablas operativas de `RESET_TABLES` y `securityAuditLog` permanece intacta

---

## 9. Trazabilidad RF → CA → Tests

| Requisito              | Criterio                          | Cobertura automatizada                                                                                                                                      |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-001                 | Catálogos y duplicados            | `tests/catalogs.test.ts`, `tests/catalogsCard.test.tsx`                                                                                                     |
| RF-002                 | Archivo automático y vistas       | `tests/archive.test.ts`, `tests/archiveDataHelpers.test.ts`, `tests/archiveListHelpers.test.ts`                                                             |
| RF-003, RF-004         | Papelera y limpieza de `_storage` | `tests/trash.test.ts`, `tests/trashCard.test.tsx`, `tests/storageCleanup.test.ts`, `tests/cleanupLog.test.ts`, `tests/reportUploads.test.ts`                |
| RF-005, CA-001, RN-001 | Seed y vaciado seguro             | `tests/seed.test.ts`, `tests/workshopReset.test.ts`, `tests/emptyWorkshop.test.ts`, `tests/workshopSettingsView.test.tsx`, `tests/mailSharesBackup.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en este módulo.
