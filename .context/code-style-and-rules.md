# Guía de Estilo, Convenciones y Reglas de Código (`.context/code-style-and-rules.md`)

## 1. Convenciones de Nomenclatura y Estructura de Ficheros

| Elemento | Convención | Ejemplo Real del Codebase |
|---|---|---|
| **Componentes React** | `PascalCase.tsx` | `EquipmentFormDialog.tsx`, `ManualRow.tsx`, `RequestsTable.tsx` |
| **Archivos de Dominio** | `camelCase.ts` | `incidentFlow.ts`, `requestFlow.ts`, `purchaseFlow.ts` |
| **Backend Convex** | `camelCase.ts` | `incidents.ts`, `requests.ts`, `equipment.ts` |
| **Hooks personalizados** | `useCamelCase.ts` | `useEquipmentFilters.ts`, `useAuth.ts` |
| **Interfaces y Tipos** | `PascalCase` | `EquipmentFormData`, `ManualItem`, `RequestStatus` |
| **Funciones puras / Helpers** | `camelCase` | `getEquipmentStatusBadge()`, `formatDate()` |
| **Constantes globales / Enums** | `UPPER_SNAKE_CASE` | `ALLOWED_TRANSITIONS`, `DEFAULT_PAGE_SIZE` |

### Estructura Canónica de una Feature UI (`src/pages/dashboard/<feature>/`)
Cuando una vista crezca más allá de ~150 líneas, debe modularizarse siguiendo el patrón de `equipment/` y `requests/`:
```
src/pages/dashboard/<feature>/
├── <Feature>Page.tsx        # Contenedor principal orquestador (mínima lógica de estado)
├── types.ts                 # DTOs, interfaces de formulario y tipos locales
├── helpers.ts               # Formateadores puros, estilos condicionales y badges
├── components/              # Subcomponentes atómicos (filas, cards, filtros, tablas)
│   ├── <Feature>Filters.tsx
│   └── <Feature>Row.tsx
├── dialogs/                 # Modales y diálogos de formulario (separados de la vista)
│   ├── Create<Feature>Dialog.tsx
│   └── Edit<Feature>Dialog.tsx
└── <feature>.test.ts        # Tests unitarios de helpers y componentes
```

---

## 2. Tipado Estricto y Tratamiento de Nulos

1. **Prohibición de `any`:**
   Todo dato debe tener un tipo estricto. Si interactúas con la base de datos de Convex, usa:
   ```typescript
   import { Doc, Id } from "@/convex/_generated/dataModel";

   type EquipmentDoc = Doc<"equipment">;
   type IncidentId = Id<"incidents">;
   ```
2. **Nulos y Opcionales:**
   - Usa `null` para campos explícitamente ausentes provenientes de la base de datos.
   - Usa `undefined` para parámetros opcionales de funciones o props de React.
   - Utiliza encadenamiento opcional (`obj?.prop`) y operador nullish coalescing (`value ?? fallback`).
   - Evita el operador de aserción no nula (`!`) a menos que haya una validación previa estricta e incontestable.

---

## 3. Manejo de Errores y Notificaciones al Usuario

1. **En Backend (Convex):**
   Lanza instancias explícitas de `Error` con mensajes en español comprensibles para el usuario de taller:
   ```typescript
   if (!canTransitionIncident(currentStatus, newStatus)) {
     throw new Error(`Transición no permitida de ${currentStatus} a ${newStatus}`);
   }
   ```
2. **En Frontend (React):**
   - Captura errores en las llamadas a mutaciones y muéstralos mediante `toast.error(err.message)`.
   - Limpia el estado de carga (`loading = false`) en bloques `finally`.
   - No dejes promesas sueltas sin `catch` ni `await`.

---

## 4. Anti-Patrones Identificados en este Codebase (LO QUE NUNCA DEBES HACER)

### ❌ Anti-Patrón 1: "God Component" en Vistas de Dashboard
- **Error:** Colocar formularios gigantes, tablas, lógica de filtrado y sub-diálogos en un único archivo de 800+ líneas.
- **Solución Correcta:** Como se hizo en la refactorización de `EquipmentPage.tsx` y `RequestsPage.tsx`, extrae los diálogos a `dialogs/`, las filas a `components/` y las funciones auxiliares a `helpers.ts`.

### ❌ Anti-Patrón 2: Validación de Estados Inline en Mutations o Componentes
- **Error:**
  ```typescript
  // MAL: Hardcodear lógica de negocio en la UI o en la mutación
  if (incident.status === "resolved" && targetStatus === "in_progress") { ... }
  ```
- **Solución Correcta:**
  ```typescript
  // BIEN: Consultar la máquina de estados en src/lib/
  import { canTransitionIncident } from "@/lib/incidentFlow";
  if (!canTransitionIncident(incident.status, targetStatus)) { ... }
  ```

### ❌ Anti-Patrón 3: Props Drilling Extremo en Diálogos
- **Error:** Pasar 25 props individuales (`name`, `setName`, `serialNumber`, `setSerialNumber`, `brand`, etc.) a un diálogo de formulario.
- **Solución Correcta:** Agrupar en un objeto de estado coherente (`formData: EquipmentFormData`) y un setter o callback único (`onChange: (field, value) => void` / `onSubmit`).

### ❌ Anti-Patrón 4: Mezclar Dependencias de Framework en el Núcleo
- **Error:** Importar hooks de React (`useState`, `useEffect`) o utilidades de Convex dentro de `src/lib/`.
- **Consecuencia:** Rompe la portabilidad del dominio y hace fallar `tests/arquitectura.test.ts`.
