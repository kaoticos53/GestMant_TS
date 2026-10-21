# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PART-FORM-DOMAIN`
- **Objetivo:** Fase 1 - Extracción de lógica pura de dominio, DTOs y validación desacoplada para el formulario de repuestos con tests unitarios.
- **Módulo(s) Afectado(s):** `src/pages/dashboard/inventory/domain/partForm.ts`, `tests/partFormDomain.test.ts`.

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/inventory/domain/partForm.ts`: Tipos `PartFormValues`, `PartPayload`, parsers numéricos y validación declarativa pura.
- [x] `tests/partFormDomain.test.ts`: Pruebas unitarias de validación y transformación de DTOs (9 tests pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas (18/18 tests pasados).

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `src/pages/dashboard/inventory/domain/partForm.ts`.
- [x] **Paso 2:** Crear `tests/partFormDomain.test.ts`.
- [x] **Paso 3:** Validar con `npx vitest run tests/partFormDomain.test.ts` y `npx tsc --noEmit`.
- [x] **Paso 4:** Commit atómico de la Fase 1.

