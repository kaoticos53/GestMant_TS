# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** SEC-FASE-5: Gobernanza y Guardrails Automatizados en CI/CD y Reglas de Agente
- **Objetivo:** Implementar la suite de análisis estático y guardrails en `tests/seguridad.test.ts`, actualizar `AGENTS.md` y `.context/code-style-and-rules.md` con las invariantes de seguridad de AppSec, y verificar que no haya regresiones.
- **Módulo(s) Afectado(s):** `tests/seguridad.test.ts`, `AGENTS.md`, `.context/code-style-and-rules.md`.

---

## 2. Archivos a Modificar / Crear
- [x] `tests/seguridad.test.ts`: Crear suite de tests estáticos de seguridad (mutaciones autenticadas, no emails admin hardcodeados, no eval/new Function/dangerouslySetInnerHTML no controlado, tabla securityAuditLog inmutable).
- [x] `AGENTS.md`: Incorporar la sección de Guardrails AppSec y comandos de testeo de seguridad en las tablas de tooling y verificación.
- [x] `.context/code-style-and-rules.md`: Documentar las reglas de seguridad y prevención de inyecciones / bypass de RBAC.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No importa convex ni react en `src/lib/`.
- [x] ¿Modifica estados o transiciones? No modifica máquinas de estado.
- [x] ¿Introduce términos nuevos? Respeta el vocabulario de `GLOSARIO.md`.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Planificar e implementar `tests/seguridad.test.ts`.
- [x] **Paso 2:** Actualizar `AGENTS.md` y `.context/code-style-and-rules.md`.
- [x] **Paso 3:** Ejecutar comprobación de tipos: `npx tsc --noEmit`.
- [x] **Paso 4:** Ejecutar test unitario del módulo: `npx vitest run tests/seguridad.test.ts`.
- [x] **Paso 5:** Ejecutar test de arquitectura: `npx vitest run tests/arquitectura.test.ts`.
- [x] **Paso 6:** Completar el resumen de sesión y marcar tareas completadas.
