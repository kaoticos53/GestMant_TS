# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** [ej. INC-042-transicion-espera-repuesto]
- **Objetivo:** [Descripción en una frase del objetivo]
- **Módulo(s) Afectado(s):** [ej. `src/convex/incidents.ts`, `src/lib/incidentFlow.ts`, etc.]

---

## 2. Archivos a Modificar / Crear
- [ ] `ruta/al/archivo.ts`: [qué se va a hacer]

---

## 3. Comprobaciones de Invariantes Previas
- [ ] ¿Afecta a `src/lib/`? Asegurar que NO importe React ni Convex.
- [ ] ¿Modifica estados o transiciones? Usar máquinas de estado en `src/lib/`.
- [ ] ¿Introduce términos nuevos? Comprobar con `GLOSARIO.md`.
- [ ] ¿Seguridad en Convex? Verificar identidad y permisos con `requireUser`/`requireAdmin`/`requireManager`.

---

## 4. Checklist de Ejecución
- [ ] **Paso 1:** Planificación y propuesta técnica aprobada.
- [ ] **Paso 2:** Implementación quirúrgica.
- [ ] **Paso 3:** Comprobación de tipos (`npx tsc --noEmit`).
- [ ] **Paso 4:** Tests específicos del módulo (`npx vitest run <ruta-del-test>`).
- [ ] **Paso 5:** Tests de arquitectura y seguridad (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`).
- [ ] **Paso 6:** Handover registrado y limpieza de este archivo.






