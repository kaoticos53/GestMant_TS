# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MESSAGES-CENTER`
- **Objetivo:** Fase 3 - Reensamblado de `MessagesCenter.tsx` como orquestador limpio y desacoplado.
- **Módulo(s) Afectado(s):**
  - `src/components/MessagesCenter.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/MessagesCenter.tsx`: Orquestador principal refactorizado, consumiendo los nuevos hooks y subcomponentes (reducido de 584 a 152 líneas, ~74% de reducción).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reensamblar `MessagesCenter.tsx`.
- [x] **Paso 2:** Verificar tipos con `npx tsc -b`.
- [x] **Paso 3:** Ejecutar suite de pruebas de mensajería con Vitest (22 tests verdes).
- [x] **Paso 4:** Commit atómico de Fase 3.
