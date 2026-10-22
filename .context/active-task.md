# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-PENDING-SECTION`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales desacoplados (`PurchaseRequestActionDialog`, `PurchaseRequestRow`, `MissingStockCard`, `SupplierGroupCard`).
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/pending/components/PurchaseRequestActionDialog.tsx`
  - `src/pages/dashboard/purchasing/components/pending/components/PurchaseRequestRow.tsx`
  - `src/pages/dashboard/purchasing/components/pending/components/MissingStockCard.tsx`
  - `src/pages/dashboard/purchasing/components/pending/components/SupplierGroupCard.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `PurchaseRequestActionDialog.tsx`: Diálogo modal singleton elevado para proveedor/nota/retirar.
- [x] `PurchaseRequestRow.tsx`: Fila puramente presentacional sin modales en el DOM.
- [x] `MissingStockCard.tsx`: Tarjeta de peticiones de repuesto sin material en almacén.
- [x] `SupplierGroupCard.tsx`: Tarjeta de agrupación por proveedor con selector de grupo.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `PurchaseRequestActionDialog.tsx`.
- [x] **Paso 2:** Crear `PurchaseRequestRow.tsx`.
- [x] **Paso 3:** Crear `MissingStockCard.tsx`.
- [x] **Paso 4:** Crear `SupplierGroupCard.tsx`.
- [x] **Paso 5:** Verificar con `npx tsc -b`.
- [x] **Paso 6:** Commit atómico de Fase 2.
