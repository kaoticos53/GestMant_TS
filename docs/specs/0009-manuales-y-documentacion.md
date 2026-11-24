# SPEC-0009 — Manuales y Documentación Técnica

- **ID:** `SPEC-0009`
- **Título:** Gestión de manuales PDF y notas técnicas del taller
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/manuals.ts`, `src/lib/manuals.ts`, `src/lib/manualRecord.ts`, `src/lib/sampleManuals.ts`, `src/pages/dashboard/ManualsView.tsx`, `src/pages/dashboard/manuals/*`

---

## 1. Contexto y Objetivos

Almacena documentación técnica del taller en dos formatos: archivos PDF (`kind: "file"`) y notas técnicas editadas con `RichTextEditor` (`kind: "note"`), vinculados por modelo (`equipmentModels`), equipo físico (`equipment`) o clasificación libre de taller.

---

## 2. Modelo de Dominio

- **`manuals`:** `title`, `kind` (`"file"` | `"note"`), `type`, `brand?`, `model?`, `modelId?`, `equipmentId?`, `storageId?`, `fileName?`, `contentType?`, `size?`, `notes?`, `author?`, `authorId?`, `history?: Array<{ action, at, by, fields?, ... }>`.

---

## 3. Requisitos Funcionales

- **RF-001 (Subida y verificación PDF):** `manuals.generateUploadUrl` + `verifyManualPdf` validan que el archivo subido sea un PDF real por *magic bytes* antes de persistir la ficha.
- **RF-002 (Notas del taller):** Permite crear fichas de solo nota o añadir notas a un PDF existente.
- **RF-003 (Historial y reemplazo de PDF):** Cada creación, edición o sustitución de archivo queda registrada en `manuals.history`, conservando la referencia al archivo anterior si aplica.
- **RF-004 (Exportación):** `manualRecord.ts` exporta la ficha del manual en Markdown/PDF.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** Un técnico sin `manageManuals` puede editar/corregir sus propias notas (`authorId === user._id`).
- **RN-002:** Mientras un manual cite un `storageId`, la limpieza nocturna (`storageCleanup`) no lo elimina.

---

## 5. Permisos y Seguridad

- Consultar manuales: `viewManuals`.
- Crear/subir, editar o eliminar manuales: `manageManuals` (con excepción de edición de nota propia por `authorId`).

---

## 6. Requisitos No Funcionales

- **RNF-001:** Los manuales de archivo se descargan o previsualizan de forma segura desde `_storage`.
- **RNF-002 (Proyección ligera CQRS):** `manuals.list` conserva la `url` del archivo principal para descarga directa en tabla pero omite firmar `history[].url` por defecto (`includeHistoryUrls?: boolean`), mientras que `manuals.detail({ manualId })` resuelve las URLs completas del historial bajo demanda desde `ManualDetailSheet`.

---

## 7. Interfaz de Usuario

- `ManualsView.tsx`, `ManualDetailSheet.tsx`, `ManualFormDialog.tsx`, `ManualRow.tsx`.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Validación de PDF real**
  - **Dado** un archivo que no comienza con cabecera `%PDF`
  - **Cuando** se intenta verificar en `manuals.verifyManualPdf`
  - **Entonces** el backend rechaza el archivo e impide guardar el manual

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001..RF-003, CA-001, RN-001 | CRUD, autoría, historial y PDF | `tests/manuales.test.ts`, `tests/uploads.test.ts` |
| RF-004 | Exportación y helpers UI | `tests/manualRecord.test.ts`, `tests/manualsColumns.test.ts`, `tests/manualsListState.test.ts`, `tests/manualDetailSheetHelpers.test.ts`, `tests/manualFormDialogHelpers.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en este módulo.
