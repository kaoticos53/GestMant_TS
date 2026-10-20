# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** [ej. REQ-crear-dialogo-asociar]
- **Objetivo:** [Breve descripción en una línea del resultado esperado].
- **Módulo(s) Afectado(s):** [ej. `src/pages/dashboard/requests/` y `src/lib/requestFlow.ts`].

---

## 2. Archivos a Modificar / Crear
- [ ] `ruta/al/archivo-1.ts`: [Acción específica].
- [ ] `ruta/al/archivo-2.tsx`: [Acción específica].

---

## 3. Comprobaciones de Invariantes Previas
- [ ] ¿Afecta a `src/lib/`? ¿Cumple con no importar React ni Convex?
- [ ] ¿Modifica estados o transiciones? ¿Pasa por la máquina de estados de `src/lib/`?
- [ ] ¿Introduce términos nuevos? ¿Están en `GLOSARIO.md`?
- [ ] ¿Seguridad en Convex? ¿Verifica identidad o usa `INITIAL_ADMIN_EMAIL`?

---

## 4. Checklist de Ejecución
- [ ] **Paso 1:** Planificación y propuesta técnica aprobada.
- [ ] **Paso 2:** Implementación quirúrgica.
- [ ] **Paso 3:** Comprobación de tipos (`npx tsc --noEmit`).
- [ ] **Paso 4:** Tests específicos del módulo (`npx vitest run <ruta-del-test>`).
- [ ] **Paso 5:** Tests de arquitectura y seguridad (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`).
- [ ] **Paso 6:** Handover registrado y limpieza de este archivo.
