# Tarea Activa (`.context/active-task.md`)

*No hay tareas activas en este momento. Todas las fases del plan de modernización han concluido y están verificadas.*

---

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `[ID-DE-LA-TAREA]`
- **Objetivo:** [Descripción clara de qué se quiere lograr]
- **Módulo(s) Afectado(s):** [ej. `src/pages/dashboard/equipment/`]

---

## 2. Archivos a Modificar / Crear
- [ ] `ruta/al/archivo1.ts`: [Breve descripción del cambio]
- [ ] `ruta/al/archivo2.tsx`: [Breve descripción del cambio]

---

## 3. Comprobaciones Previas e Invariantes
- [ ] ¿Afecta a `src/lib/`? (Si es sí, asegurar NO importar React ni Convex).
- [ ] ¿Afecta a máquinas de estado? (Usar las existentes en `src/lib/`).
- [ ] ¿Respeta el Vocabulario Ubicuo de `GLOSARIO.md`?
- [ ] ¿Requiere nuevos paquetes npm? (Evitar salvo aprobación expresa).
- [ ] ¿Requiere comprobaciones de identidad/rol en Convex?

---

## 4. Checklist de Validación y Cierre
- [ ] `npx tsc --noEmit` ejecutado sin errores.
- [ ] Test unitario del módulo ejecutado con éxito (`npx vitest run <ruta-del-test>`).
- [ ] Test de arquitectura ejecutado (`npx vitest run tests/arquitectura.test.ts`).
- [ ] Test de seguridad ejecutado (`npx vitest run tests/seguridad.test.ts`).
- [ ] Handover registrado en `.context/sessions/` con la plantilla correspondiente.
