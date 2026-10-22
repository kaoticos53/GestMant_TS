# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-PENDING-SECTION`
- **Objetivo:** Fase 3 - Reensamblado de `PendingSection.tsx` como orquestador limpio y desacoplado.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/purchasing/components/PendingSection.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `PendingSection.tsx`: Orquestador principal refactorizado, reducido de 552 a 129 líneas (~77% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reensamblar `PendingSection.tsx`.
- [x] **Paso 2:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 3:** Ejecutar suite de pruebas de compras con Vitest (38 tests verdes).
- [x] **Paso 4:** Commit atómico de Fase 3.
