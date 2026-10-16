# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** [ID_O_NOMBRE_BREVE]
- **Objetivo:** [Explicación concisa del problema a resolver o funcionalidad a añadir]
- **Módulo(s) Afectado(s):** [Carpetas o submódulos impactados]

---

## 2. Archivos a Modificar / Crear
- [ ] `ruta/al/archivo1.ts`: [Breve descripción del cambio planificado]
- [ ] `ruta/al/archivo2.tsx`: [Breve descripción del cambio planificado]

---

## 3. Comprobaciones de Invariantes Previas
- [ ] ¿Afecta a `src/lib/`? Asegurar que NO importe React ni Convex.
- [ ] ¿Modifica estados o transiciones? Usar máquinas de estado en `src/lib/`.
- [ ] ¿Introduce términos nuevos? Comprobar con `GLOSARIO.md`.

---

## 4. Checklist de Ejecución
- [ ] **Paso 1:** Planificación y propuesta técnica aprobada.
- [ ] **Paso 2:** Implementación quirúrgica.
- [ ] **Paso 3:** Comprobación de tipos (`npx tsc --noEmit`).
- [ ] **Paso 4:** Tests específicos del módulo (`npx vitest run <ruta-test>`).
- [ ] **Paso 5:** Tests de arquitectura y seguridad (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`).
- [ ] **Paso 6:** Handover registrado y limpieza de este archivo.

