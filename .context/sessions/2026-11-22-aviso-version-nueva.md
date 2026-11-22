# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-22
- **Agente / Modelo:** Buffy (Freebuff)
- **Rama / Commit:** feat/correo-f1-base-pura / pendiente de commit

---

## 1. Objetivo Principal de la Sesión

Cambiar la PWA de `autoUpdate` con `skipWaiting` a un aviso de «hay una versión
nueva · Recargar» que enseña el número de build, para que nadie depure una
interfaz que no cambia porque el navegador sirve otra compilación.

---

## 2. Archivos Modificados y Creados

| Archivo | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `vite.config.ts` | Configuración | `registerType: "prompt"` y `workbox.skipWaiting/clientsClaim` en `false`: la compilación nueva se descarga y espera, en vez de tomar el control sola. |
| `src/main.tsx` | Registro | `registerSW({ immediate: true, onNeedRefresh })` avisa con `offerUpdate(() => updateServiceWorker(true))`; se monta `<PwaUpdateBanner />` junto al `Toaster`. |
| `src/lib/pwaUpdate.ts` | Lógica nueva | Estado del aviso fuera de React (sin React ni Convex, como manda el guardarraíl de `src/lib/`), leído con `useSyncExternalStore`. |
| `src/components/PwaUpdateBanner.tsx` | UI nueva | Aviso `role="status"` con «Hay una versión nueva», «Esta pestaña sirve la bNNN» y los botones «Luego» / «Recargar». |
| `tests/pwaUpdateBanner.test.tsx` | Pruebas nuevas | 4 casos: silencio sin novedad, aviso con la build, no recarga sola y «Luego» retira el aviso. |

---

## 3. Decisiones Técnicas y de Diseño Tomadas

- **Decisión 1:** El número que se enseña es el de la pestaña, no el de la
  compilación que espera. El de la nueva no se puede conocer antes de cargarla
  —su `version.json` lo sirve el propio service worker viejo—, y para el
  problema real («creía estar en la última y estaba en la b128») el build de la
  pestaña es justo el dato que faltaba.
- **Decisión 2:** El estado vive en `src/lib/pwaUpdate.ts` y no en `main.tsx`
  para no meter otro `createRoot` ni registrar el service worker dentro de un
  componente: `main.tsx` registra, el aviso se suscribe.
- **Decisión 3:** «Luego» no destruye el service worker en espera: se activa en
  la siguiente apertura, que es lo que ya hacía `autoUpdate` sin preguntar.
- **Decisión 4:** No se tocan el precache ni el `CacheFirst` de `/api/storage/`:
  el problema era cuándo se activa una versión, no qué se guarda.

---

## 4. Estado de Verificación y Testing

- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores
- **Linting:** ✅ 0 errores (los 2 avisos de Fast Refresh en `main.tsx` son
  anteriores a esta sesión)
- **Pruebas nuevas:** ✅ 4/4; arquitectura ✅ 9/9
- **Suite completa (`npx vitest run`):** ✅ exit 0, 271 archivos
- **Compilación (`npm run build`):** ✅ 5,69 s, precache 106 entradas
- **Service worker generado:** ✅ una sola aparición de `skipWaiting`, dentro del
  mensaje `SKIP_WAITING` (activación solo a petición); `clientsClaim` ausente;
  `index.html`, `manifest.webmanifest` y `logo.svg` siguen en el precache.
- **Bundle:** ✅ `index-…js` incluye el aviso y el `registerSW` con
  `onNeedRefresh`; el texto interpola el build (`"Esta pestaña sirve la b"`).
- **Pruebas Manuales / UI:** ❌ no se probó el ciclo de dos compilaciones en un
  navegador real (haría falta servir `dist/`, publicar otra build y mirar el
  aviso); lo verificado es el artefacto generado y la lógica del aviso en jsdom.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes

- [ ] Servir `dist/` con dos compilaciones seguidas y comprobar en el navegador
      que el aviso aparece, que «Recargar» activa la nueva y que «Luego» la deja
      para la próxima apertura.
- [ ] Si molesta que tras «Luego» no vuelva a avisar en esa pestaña, guardar el
      descarte y comprobar de nuevo al recuperar el foco.
- ⚠️ **Riesgo conocido:** en una pestaña abierta mucho tiempo, la primera
  comprobación de actualización la hace el registro al cargar; el aviso no
  aparece hasta que el navegador descarga el `sw.js` nuevo.

---

## 6. Ajuste posterior — colocación del aviso (2026-11-22)

El aviso nació abajo a la derecha (`bottom-3 … sm:right-4`), que es exactamente
donde sonner apila sus toasts (el `Toaster` de `main.tsx` no fija `position`, así
que usa su valor por defecto `bottom-right`). En cuanto saliera un aviso —un
«Deshacer», un error de descarga— el toast tapaba el botón «Recargar».

**Decisión:** subirlo arriba, a la izquierda en escritorio y a todo el ancho en
móvil:

```
fixed inset-x-3 top-3 z-50 … sm:inset-x-auto sm:top-4 sm:left-4
```

Arriba es la única zona que sonner no ocupa. Se conserva `role="status"` (región
viva, sin `aria-label` que tape el texto) y el número de build en el contenido.

**Comprobado en el bundle** (`npm run build`, exit 0, 7,05 s):

- `dist/assets/index-9rbKESLb.js` contiene el aviso con
  `fixed inset-x-3 top-3 … sm:top-4 sm:left-4`, `role:"status"` y el texto
  «Esta pestaña sirve la b» interpolado con el build.
- El mismo chunk trae el `Toaster` de sonner con su posición por defecto
  `"bottom-right"`: las dos piezas ya no comparten esquina.
- `tests/pwaUpdateBanner.test.tsx` gana una prueba que impide volver a la
  esquina de sonner (`sm:left-4` presente; `sm:right-4` y `bottom-3` ausentes):
  5/5 en verde.

**Compromiso conocido:** en móvil el aviso queda arriba, igual que
`ApiAddressNotice` (que solo aparece cuando la API pública no responde). Si
coinciden —raro: uno es de despliegue y el otro de configuración rota— el aviso
de versión se pinta encima porque va después en el DOM. Se acepta a cambio de no
perder pulsaciones bajo un toast.

> Ese compromiso quedó **revocado** en la sección 7: en un navegador de verdad
> el aviso de arriba era además inalcanzable en móvil.

---

## 7. Ciclo de actualización probado en el navegador (2026-11-22)

Prueba real, con `dist/` servido por `vite preview` en `http://127.0.0.1:4173`
y recompilando sobre el mismo origen (`npm run build` sella un build nuevo).
Backend Convex caído (`127.0.0.1:3210`), así que la portada muestra
`ApiAddressNotice`.

### 7.1 Lo que fallaba: una pestaña abierta nunca se enteraba

Con `registerType: "prompt"` el aviso solo sale si alguien llama a
`registration.update()`. El navegador lo hace al navegar —y al navegar la
página ya se recarga, así que el aviso sobra— y la especificación deja la
comprobación periódica en manos de la aplicación. Comprobado en la pestaña
real: con una build nueva en el servidor, `installing`, `waiting` y aviso
seguían en `false` indefinidamente. El registro y el store funcionaban: un
`await registration.update()` manual hacía aparecer `waiting` y el aviso con el
texto correcto («Esta pestaña sirve la b130»).

**Arreglo (`src/main.tsx`):** `onRegisteredSW` programa `registration.update()`
cada 60 s y en cada `visibilitychange` a `visible` (portátil que despierta de la
suspensión). Un `sw.js` de 7 KB por minuto, servido con `Cache-Control:
no-cache`.

### 7.2 Lo que fallaba: arriba el aviso no se podía pulsar en móvil

Medido en la pestaña real a 390×844: el aviso (`fixed inset-x-3 top-3`, ancho
350, alto 66) y el `ApiAddressNotice` (`fixed`, ancho 350, alto 255) ocupaban
exactamente el mismo rectángulo, y la cabecera del sitio (h-16) también pisa esa
zona. Los clics de puntero real sobre «Recargar» **no navegaban**: el hit-test
caía en el alert de API, no en el botón. Con `element.click()` programático sí
funcionaba, que es la trampa de verificar esto solo en jsdom.

**Arreglo:** abajo en vez de arriba, con sonner apartándose en móvil.

```
PwaUpdateBanner   fixed inset-x-3 bottom-3 z-50 … sm:inset-x-auto sm:bottom-4 sm:left-4
components/ui/sonner.tsx   mobileOffset={updateReady ? { bottom: 92 } : undefined}
```

En escritorio el aviso va abajo a la izquierda y los toasts siguen abajo a la
derecha. En móvil el aviso ocupa el ancho de abajo y, mientras está visible, los
toasts suben 92 px (aviso: 12 de margen + 66 de alto → 14 px de aire). Medido en
la pestaña: `banner {y:766, h:66}`, `apiNotice null`, `elementFromPoint` en el
centro del aviso devuelve el aviso, y el clic real navega.

### 7.3 Ciclo completo verificado (builds b130 → b138)

| Paso | Resultado |
|---|---|
| Primera carga con `dist/` en 4173 | build b130 en pantalla, SW `activated`, `controlled:false`; tras recargar, `controlled:true` |
| Recompilar (b131) con la pestaña abierta | ❌ sin arreglo: `installing/waiting/aviso:false` — no se enteraba |
| `registration.update()` manual | ✅ `waiting:true` y aviso con «Esta pestaña sirve la b130» |
| «Recargar» (clic real) | ✅ navega y la pestaña queda en la build nueva, `waiting:false`, sin aviso |
| Bucle de 60 s sin tocar nada (b132 → b133) | ✅ el aviso sale solo |
| «Luego» | ✅ aviso fuera, `waiting:true` intacto, misma build en pantalla |
| Cerrar la pestaña y abrir otra | ✅ entra la compilación pendiente (b133), `controlled:true`, sin aviso |
| Código final (b137 → b138) | ✅ aviso tras 60 s sin interacción y «Recargar» real lleva a b138 |

### 7.4 Verificación

- `npx tsc --noEmit` ✅ · `npx eslint` ✅ 0 errores (los 2 avisos de Fast
  Refresh de `main.tsx` son anteriores)
- `tests/pwaUpdateBanner.test.tsx` ✅ 6/6: se suma un caso que monta el `Toaster`
  real con un toast y comprueba que pasa de `--mobile-offset` por defecto a
  `--mobile-offset-bottom: 92px` mientras el aviso está abierto.
- Suite completa ✅ 2873 pruebas, 272 archivos; `security:check` ✅.
- `npm run build` ✅ (b138, precache 106 entradas).

**Sigue en pie la deuda** de guardar el descarte de «Luego»; probado que la
compilación entra en la siguiente apertura, que es lo prometido.
