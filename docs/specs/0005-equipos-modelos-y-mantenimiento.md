# SPEC-0005 — Equipos, Modelos, Mantenimiento y Desplazamientos

- **ID:** `SPEC-0005`
- **Título:** Inventario de equipos, catálogo de modelos, mantenimientos, etiquetas QR y desplazamientos
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/equipment.ts`, `src/convex/equipmentModels.ts`, `src/convex/maintenance.ts`, `src/convex/equipmentMovements.ts`, `src/convex/_inventory/movements.ts`, `src/lib/movements.ts`, `src/lib/machineSheet.ts`, `src/lib/equipmentRecord.ts`, `src/lib/labelGenerator.ts`, `src/lib/qr.ts`, `src/pages/dashboard/EquipmentView.tsx`, `src/pages/dashboard/equipment/*`

---

## 1. Contexto y Objetivos

Gestiona el parque de equipos físicos del taller (`EQ-XXX`), su catálogo maestro de modelos (`equipmentModels`), las intervenciones de mantenimiento preventivo/correctivo (`maintenanceRecords`), el historial de desplazamientos de ubicación y ciclo de vida (`equipmentMovements`), la impresión de etiquetas QR y el escaneo por código de barras.

---

## 2. Modelo de Dominio

- **`equipment`:** `modelId?`, `code` (`EQ-001`), `brand?`, `name`, `model`, `location?`, `description?` (richDoc), `serialNumber?`, `supplier?`, `purchaseDate?`, `decommissionDate?`, `warrantyEndDate?`, `maintenanceIntervalDays?`.
- **`equipmentModels`:** `model`, `name`, `brand?`, `defaultSupplier?`, `defaultMaintenanceIntervalDays?`, `description?`.
- **`maintenanceRecords`:** `equipmentId`, `kind` (`repair` | `preventive`), `title`, `description?`, `performedAt`, `technician?`, `requestId?`.
- **`equipmentMovements`:** `equipmentId`, `equipmentCode?`, `equipmentName`, `kind` (`created` | `location_change` | `decommission` | `reactivation`), `fromLocation?`, `toLocation?`, `actorId?`, `actorName`, `createdAt`.

---

## 3. Requisitos Funcionales

- **RF-001 (Alta y plantilla de modelo):** `equipment.create` genera código libre `EQ-XXX` si no se indica, resuelve/crea el `equipmentModels` asociado y registra un movimiento `created`. En la UI (`useEquipmentForm`), al escribir un modelo del catálogo se rellenan marca, nombre, proveedor e intervalo por defecto sin pisar campos ya editados.
- **RF-002 (Edición y desplazamientos):** `equipment.update` usa `detectEquipmentChanges` (`src/lib/movements.ts`) para registrar automáticamente traslados (`location_change`), bajas (`decommission`) y reactivaciones (`reactivation`) sin falsos positivos cuando no cambian ubicación ni fecha de baja.
- **RF-003 (Mantenimiento preventivo/correctivo):** `maintenance.create`/`update`/`remove` gestionan intervenciones vinculadas al equipo y calculan el estado de revisión preventiva (`useEquipmentDerivedData`).
- **RF-004 (Etiquetas y exportación):** Generación de etiquetas QR/código de barras (`PrintLabelDialog`, `labelGenerator`, `qr`) y exportación de ficha completa del equipo en Markdown/PDF (`equipmentRecord`).
- **RF-005 (Escáner de etiquetas IA):** `EquipmentFormDialog` integra `EquipmentLabelScanner` (solo autenticado) para extraer marca, modelo, nº de serie, tipo y descripción técnica desde foto (`SPEC-0012`).

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** El código `code` de un equipo es único (`codeClash`).
- **RN-002:** Al borrar un equipo físico (`equipment.remove`), la compatibilidad de los repuestos asociada a `equipmentModels` permanece intacta.
- **RN-003:** Las fechas de alta, baja y garantía se validan coherentemente (`validateDates`).

---

## 5. Permisos y Seguridad

- Ver inventario de equipos: `viewEquipment` (o `lookupEquipment` para vincular incidencias).
- Crear/editar/eliminar equipos e intervenciones: `manageEquipment`.
- `equipmentMovements.listByEquipment`: requiere sesión activa no anónima y `viewEquipment` | `manageEquipment` | `lookupEquipment`.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Validación de duplicados en `equipmentModels` y herramienta de consolidación `backfillModelsFromEquipment`.

---

## 7. Interfaz de Usuario

- `EquipmentView.tsx`: tabla filtrable/ordenable de equipos, alertas de revisiones vencidas, escáner de código de barras (`BarcodeScannerModal`).
- `EquipmentDetailSheet.tsx`: ficha lateral con datos generales, exportación PDF, mantenimiento, manuales, repuestos compatibles, peticiones y **Desplazamientos y ciclo de vida** (`EquipmentMovementsSection`).

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Registro automático de traslado**
  - **Dado** un equipo ubicado en `"Plató 1"`
  - **Cuando** se actualiza su ubicación a `"Unidad Móvil 2"`
  - **Entonces** se inserta un registro `location_change` con `fromLocation: "Plató 1"` y `toLocation: "Unidad Móvil 2"`

- **CA-002 — Edición sin falsos movimientos**
  - **Dado** un equipo existente
  - **Cuando** se edita únicamente su descripción sin cambiar `location` ni `decommissionDate`
  - **Entonces** no se inserta ningún registro en `equipmentMovements`

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001 | Alta, plantillas y modelos | `tests/equipos.test.ts`, `tests/equipmentModels.test.ts`, `tests/equipmentFormAutofill.test.tsx`, `tests/equipmentFormLogic.test.ts` |
| RF-002, CA-001, CA-002 | Desplazamientos y ciclo de vida | `tests/movements.test.ts`, `tests/equipmentMovements.test.ts`, `tests/movementsUi.test.tsx` |
| RF-003 | Mantenimiento preventivo | `tests/maintenance.test.ts`, `tests/maintenanceDialogHelpers.test.ts` |
| RF-004 | Etiquetas QR y ficha PDF | `tests/labelGenerator.test.ts`, `tests/qr.test.ts`, `tests/equipmentRecord.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en este módulo.
