# Guía de Gobernanza y Guardrails para Agentes de IA (`AGENTS.md`)
**Proyecto:** Pulso Taller (`GestMant_TS`) — Sistema de Gestión de Mantenimiento  
**Stack Principal:** React 19, TypeScript 5.7, Vite 7, Tailwind CSS v4, Convex 1.46 (`@convex-dev/auth`), Radix UI, Vitest 5.

---

## 1. Rol y Principios de Actuación
Cualquier agente de IA (Cursor, Copilot, Claude Code, Aider, Antigravity) que opere en este repositorio debe actuar con el rigor de un **Principal Software Engineer**.
El código de este sistema gestiona operaciones reales de mantenimiento industrial, trazabilidad de piezas y flujo de peticiones. La estabilidad, la consistencia semántica y el aislamiento de capas son innegociables.

---

## 2. Guardrails Críticos (Invariantes Obligatorias)

### ⛔ PROHIBICIONES ESTRICTAS
1. **NO importar React ni Convex en `src/lib/`:**  
   `src/lib/` contiene la lógica pura de dominio (`incidentFlow.ts`, `requestFlow.ts`, `purchaseFlow.ts`, formateadores, conversores de rich text y generadores de PDF). Está terminantemente prohibido importar `react`, `react-dom`, `convex` o `convex/*` en esta carpeta. *(Existe un test automático en `tests/arquitectura.test.ts` que fallará la build si esto ocurre)*.
2. **NO duplicar lógica de estados en Convex o Componentes:**  
   Cualquier validación o transición de estado de Incidencias, Peticiones de Repuesto u Órdenes de Compra DEBE invocar las máquinas de estado ubicadas en `src/lib/` (`canTransitionIncident`, `canTransitionRequest`, etc.). Jamás compares cadenas literales de estado a mano en mutations o componentes.
3. **NO romper el Vocabulario Ubicuo (`GLOSARIO.md`):**  
   - Usar siempre: **Incidencia** (NUNCA *ticket*, *avería* ni *fallo*).
   - Usar siempre: **Equipo** (NUNCA *máquina*, *aparato* ni *dispositivo*).
   - Usar siempre: **Petición de repuesto** (NUNCA *solicitud de material* ni *pedido interno*).
   - Usar siempre: **Parte de trabajo** (NUNCA *informe* ni *orden de servicio*).
   - Usar siempre: **Técnico** (NUNCA *operario* ni *mecánico*).
4. **NO añadir librerías externas sin autorización explícita:**  
   No introduzcas paquetes npm (ej. `moment`, `lodash`, `date-fns`, `axios`) cuando el proyecto ya provee utilidades nativas (`Intl`, utilidades en `src/lib/`, hooks y clientes Convex).
5. **NO omitir tipado estricto:**  
   El uso de `any` está prohibido. Si un tipo de Convex aún no se ha regenerado, ejecuta `npm run convex:codegen` o deriva el tipo usando `Doc<"tableName">` o `Id<"tableName">` importados de `src/convex/_generated/dataModel`.
6. **NO omitir comprobaciones de identidad en mutaciones de Convex ni hardcodear privilegios:**  
   Toda mutación pública en `src/convex/` (salvo puertas expresas de intake público con rate limiting) DEBE verificar identidad y permisos (`requireUser`, `requireAdmin`, etc.). Queda prohibido hardcodear correos literales para conceder rol `admin` (usar `INITIAL_ADMIN_EMAIL`). *(Existe un test automático en `tests/seguridad.test.ts`)*.
7. **NO usar `eval()`, `new Function()` ni `dangerouslySetInnerHTML` no autorizado:**  
   Queda terminantemente prohibida la ejecución dinámica de código o inyección arbitraria de HTML. `dangerouslySetInnerHTML` solo está autorizado en componentes de estilo aislados (`src/components/ui/chart.tsx`).
8. **NO alterar la inmutabilidad de `securityAuditLog`:**  
   La tabla `securityAuditLog` almacena la trazabilidad de seguridad y NUNCA debe incluirse en vaciados de taller (`RESET_TABLES` en `workshopReset.ts`) ni purgas masivas.

---

## 3. Tooling y Comandos Clave

Ejecuta siempre los comandos desde la raíz del proyecto (`d:\Users\ricardo\Documents\GitHub\GestMant_TS`):

| Propósito | Comando exacto |
|---|---|
| **Verificación de Tipos** | `npx tsc --noEmit` |
| **Suite de Tests Completa** | `npx vitest run` |
| **Test de Arquitectura** | `npx vitest run tests/arquitectura.test.ts` |
| **Test de Seguridad (AppSec)** | `npx vitest run tests/seguridad.test.ts` |
| **Ejecutar Test Individual** | `npx vitest run src/pages/dashboard/equipment/equipment.test.ts` |
| **Linting** | `npm run lint` |
| **Formateo de Código** | `npm run format` |
| **Servidor de Desarrollo** | `npm run dev` |
| **Codegen de Convex** | `npx convex codegen` |
| **Compilación de Producción** | `npm run build` |

> ⚠️ **Nota de Entorno:** Los tests unitarios y de arquitectura se ejecutan en memoria de forma instantánea. No ejecutes scripts de conexión externa (`nas-shell.ps1`) salvo que estés diagnosticando conectividad física del servidor NAS de almacenamiento.

---

## 4. Workflow Obligatorio de Trabajo por Tareas

Antes de modificar código, cada agente debe seguir rigurosamente este ciclo de 5 fases:

```
[1. Planificar] ➔ [2. Proponer] ➔ [3. Implementar] ➔ [4. Validar] ➔ [5. Handover]
```

### Paso 1: Planificación Previa
- Lee `.context/architecture.md`, `.context/code-style-and-rules.md` y `.context/specifications.md`.
- Rellena `.context/active-task.md` con el objetivo, archivos a tocar y checklist de pruebas.

### Paso 2: Propuesta Técnica
- Explica qué patrones aplicarás (ej. desacoplar un Dialog en subcomponentes, extraer un hook personalizado, agregar un caso a la máquina de estados en `src/lib/`).
- Confirma que no se vulneran las invariantes de `tests/arquitectura.test.ts` ni de `tests/seguridad.test.ts`.

### Paso 3: Implementación Quirúrgica
- Realiza cambios mínimos y atómicos.
- Respeta la estructura de carpetas: si una vista crece (`dialogs/`, `components/`, `types.ts`, `helpers.ts`), modularízala como se ha hecho en `src/pages/dashboard/equipment/` y `src/pages/dashboard/requests/`.

### Paso 4: Validación Automática
- Ejecuta `npx tsc --noEmit` para verificar que TypeScript no tiene errores.
- Ejecuta el test específico del módulo: `npx vitest run <ruta-del-test>`.
- Ejecuta el test de arquitectura: `npx vitest run tests/arquitectura.test.ts`.
- Ejecuta el test de seguridad: `npx vitest run tests/seguridad.test.ts`.

### Paso 5: Handover y Cierre
- Limpia `.context/active-task.md`.
- Registra el trabajo realizado en un bloque siguiendo `.context/session-state-template.md`.

---

## 5. Directorio de Gobernanza `.context/`
- [Arquitectura C4 y Fronteras de Capa](file:///.context/architecture.md)
- [Estilo, Convenciones y Anti-Patrones](file:///.context/code-style-and-rules.md)
- [Especificaciones de Dominio y APIs](file:///.context/specifications.md)
- [Plantilla de Traspaso de Sesión](file:///.context/session-state-template.md)
- [Checklist de Tarea Activa](file:///.context/active-task.md)
