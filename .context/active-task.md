# Tarea Activa (`.context/active-task.md`)

> **INSTRUCCIÓN PARA EL AGENTE:**  
> Completa esta plantilla ANTES de modificar cualquier archivo de código. Marca los elementos con `[x]` a medida que los completes. Cuando termines la tarea y registres el handover, restaura este archivo a su estado inicial.

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** 
- **Objetivo:** 
- **Módulo(s) Afectado(s):** 

---

## 2. Archivos a Modificar / Crear
- [ ] `ruta/al/archivo1.ts`: Propósito del cambio.
- [ ] `ruta/al/archivo2.tsx`: Propósito del cambio.

---

## 3. Comprobaciones de Invariantes Previas
- [ ] ¿Afecta a `src/lib/`? (Recordar: NUNCA importar React ni Convex en `src/lib/`).
- [ ] ¿Modifica estados o transiciones de dominio? (Recordar: usar máquinas de estado de `src/lib/`).
- [ ] ¿Introduce términos prohibidos en el vocabulario ubicuo? (Ver `GLOSARIO.md`).
- [ ] ¿Seguridad en Convex? (Recordar: comprobar identidad y usar `INITIAL_ADMIN_EMAIL`, nunca hardcodear emails).

---

## 4. Checklist de Ejecución
- [ ] **Paso 1:** Planificación y propuesta técnica aprobada.
- [ ] **Paso 2:** Modificación quirúrgica implementada.
- [ ] **Paso 3:** Comprobación de tipos (`npx tsc --noEmit`).
- [ ] **Paso 4:** Tests específicos del módulo (`npx vitest run <test-path>`).
- [ ] **Paso 5:** Tests de arquitectura y seguridad (`tests/arquitectura.test.ts`, `tests/seguridad.test.ts`).
- [ ] **Paso 6:** Handover registrado y limpieza de este archivo.
