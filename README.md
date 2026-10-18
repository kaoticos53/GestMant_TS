## Ejecutar en local

El backend es Convex y no basta con `npm run dev`: hay que levantar un
deployment. Este repositorio incluye un backend Convex autoalojado con Docker y
un único comando que lo deja todo en marcha:

```bash
npm start
```

Levanta los contenedores, prepara `.env.local`, despliega las funciones y
arranca la app en http://localhost:5173, terminando con una comprobación de
salud del entorno y, como última línea, la URL donde entrar. `npm run local` es
exactamente lo mismo; y si prefieres no escribir nada, `start.cmd` (Windows) o
`./start.sh` hacen el mismo arranque con doble clic y dejan la ventana abierta
con la URL a la vista. Consulta **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** para el
detalle y la solución de problemas.

Para escribir cualquier texto que se vea en la app —etiquetas, botones, avisos,
permisos—, la lista cerrada de términos está en
**[GLOSARIO.md](./GLOSARIO.md)**: qué palabra se usa para cada cosa y cuáles no
se usan.

Y el ciclo de vida de las tres cosas que se mueven en el taller —la incidencia, la
petición de repuestos y la compra—, dibujado con quién puede dar cada paso, está
en **[MAQUINAS.md](./MAQUINAS.md)**: lo escriben las tablas de `src/lib/*Flow.ts`
y [maquinas.test.ts](./tests/maquinas.test.ts) avisa si el dibujo se queda atrás. La
app pinta esas mismas tablas —generadas del código— en la pantalla **«Máquinas del
taller»**, para no tener que abrir ningún fichero para saber dónde está un caso.

Y si el taller manda el correo por su propio servidor —o desde una cuenta de
**Gmail** o un buzón de pruebas de **Ethereal**—, el repositorio trae el puente
que hace falta: el backend de Convex no abre conexiones TCP, así que el **relevo
de correo** recibe el sobre por HTTP y lo entrega por SMTP. Se arranca con
`npm run mail:relay` y la guía —local, en el NAS, con Gmail paso a paso, con sus
comprobaciones y sus tropiezos— está en **[RELEVO.md](./RELEVO.md)**.

Y las dos fronteras que el código cruza a diario —los módulos puros de `src/lib`,
que se prueban solos y no arrastran Convex, y los callbacks de `src/convex`, que
escriben lo que la máquina dijo en vez de redecidir sus reglas— las vigila
[arquitectura.test.ts](./tests/arquitectura.test.ts).

Y si lo que quieres es dejar el taller corriendo dentro de casa —en un **NAS
Synology**, con Container Manager, el backend en contenedores y un certificado de
Let's Encrypt—, la guía paso a paso está en **[SYNOLOGY.md](./SYNOLOGY.md)**, con
los archivos ya preparados en `docker/synology/`. Los pasos 1 a 5 de esa guía
—hasta dejar el taller en pie y las funciones desplegadas— los hace de una vez un
solo comando, lanzado desde el ordenador, que se puede repetir sin miedo porque
nunca pisa un `.env` que ya esté ni rota el secreto de la instancia:

```bash
npm run nas -- --host IP-del-NAS \
  --app-url https://taller.tudominio.com --api-url https://api.tudominio.com
```

Termina con la URL de la app en la última línea, igual que el arranque local. Con
`npm run nas -- --help` salen todas las opciones.

El taller queda **listo de una sola pasada**: la base **vacía** —sin datos de
ejemplo, que se dan de alta a mano— y la **cuenta de administrador ya creada**
(`admin@taller.es` / `admin12345`, o las que dejes en `ADMIN_EMAIL` y
`ADMIN_PASSWORD` dentro del `.env`). Con `PULSO_INSTALL=no` no se toca ninguna
cuenta.

Y para saber cómo está el taller sin cambiar nada —los contenedores, el `.env` y
si el esquema está al día—, el mismo comando tiene un modo de solo comprobación,
que además devuelve 0 si todo está en pie y 1 si hay algo que mirar:

```bash
npm run nas:check -- --host IP-del-NAS
```

Y antes de cada actualización, la **copia previa** —el export lógico y la copia
en frío del volumen, las dos en el NAS, conservando las últimas 7 de cada tipo y
borrando las más viejas— se lanza también desde el ordenador:

```bash
npm run nas:backup -- --host IP-del-NAS
```

No cambia datos, no toca el `.env` y no imprime ningún secreto; termina diciendo
dónde han quedado las copias. La contraseña del NAS se teclea una sola vez —y solo
si hace falta, que con clave SSH no se pide—: sirve para entrar y para el `sudo`
de dentro, que es quien hace las dos copias.

Y cuando algo no sale —o antes de tocar nada—, el **doctor** mira el entorno del
NAS y explica lo que falta, que es lo primero que se echa de menos justo cuando
nada funciona: dónde está el binario de Docker, si hace falta `sudo` y con qué
grupos y qué `PATH` cuenta, si Compose lee el proyecto desde su carpeta, qué
contenedores hay y si se puede escribir donde van las copias.

```bash
npm run nas:doctor -- --host IP-del-NAS
```

Como `nas:check`, solo mira: no escribe, ni arranca, ni para nada. Devuelve 0 si el
entorno está listo y 1 si hay algo que mirar.

Y si lo tuyo es un **servidor Proxmox** — una **VM Debian** en casa o en el
taller, con Docker y **Caddy** poniendo el HTTPS donde en el Synology lo pone DSM
—, esa guía está en **[PROXMOX.md](./PROXMOX.md)**. El montaje de contenedores
es el mismo (usa el mismo compose y el mismo script `npm run nas`), así que los
cambios son solo delante: crear la VM, instalar Docker y Caddy, y escribir el
Caddyfile en lugar de las reglas del proxy inverso de DSM.

### Instalar desde el repositorio de GitHub

En las dos plataformas se parte igual: clonar el proyecto desde GitHub y
seguir la guía de la plataforma elegida.

**NAS Synology** — clona en el ordenador (no hace falta git en el propio NAS;
quien lleva el código al NAS es el comando) y lanza:

```bash
git clone https://github.com/tu-usuario/pulso-taller.git
cd pulso-taller
npm run nas -- --host IP-del-NAS \
  --app-url https://taller.tudominio.com --api-url https://api.tudominio.com
```

Lo que hace falta en el ordenador es Node y npm (los pasos 1 a 5 los ejecuta
el comando por SSH); el NAS solo necesita Docker (Container Manager) y que se
pueda entrar por SSH.

**Proxmox** — dentro de la VM Debian también vale clonar directamente, sin
copiar nada desde otro ordenador:

```bash
apt install -y git
git clone https://github.com/tu-usuario/pulso-taller.git /srv/pulso-taller/codigo
cd /srv/pulso-taller
cp codigo/docker/synology/docker-compose.yml .
cp codigo/docker/synology/.env.example .
```

El código va en **`codigo/`**, que es donde el `docker-compose.yml` lo busca
(`context: ./codigo`). Y a partir de ahí, los pasos 2 a 6 de
**[PROXMOX.md](./PROXMOX.md)** (Docker, Caddy, `.env`, compose) se ejecutan todos
en el propio servidor. Esta vía sí dispensa Node en tu ordenador: la app se
compila dentro del servidor y las funciones las sube él solo —el contenedor
`funciones` al arrancar y el `vigilante` cuando cambian, sin reiniciar nada—.

El paso 3 de las dos guías cuenta la otra vía —clonar **dentro** del NAS o del
servidor—: allí, actualizar es `git pull` y recompilar.

**Actualizar a una versión nueva** es lo mismo con `git pull`: en el NAS,
repite `npm run nas` (o `docker compose up -d --build` desde el NAS si el
código se actualizó allí con un `git pull` en su carpeta); en Proxmox,
`git pull` en la carpeta del servidor y `docker compose up -d --build`. Los
datos nunca se tocan: viven en el volumen `pulso-taller_datos`, que ninguna de
las dos rutas borra ni reemplaza. Y si lo que ha cambiado son **solo las
funciones**, ni eso hace falta: el contenedor `vigilante` —que se queda mirando
`src/convex`— las vuelve a subir solo, sin reiniciar ni reconstruir nada.

Si lo que quieres es una demo lista para enseñar, `npm run local -- --fresh`
rehace la base de datos desde cero y carga los datos de ejemplo (se pierde lo
que hubiera en este entorno). Y si el entorno se ha quedado a medias —clave de
administrador caducada, variables de auth que faltan, funciones sin
desplegar—, `npm run local -- --repair` lo diagnostica y lo arregla **sin**
tocar los datos.

## Overview

This project uses the following tech stack:

- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- TipTap (rich text editor for notes and descriptions, images included)
- Notes and descriptions are stored as structured documents —blocks with marks,
  lists, quotes and images— instead of HTML. `src/lib/richDoc.ts` reads any
  stored value (document, legacy HTML or plain text), turns it into blocks and
  translates it to text, Markdown or the editor's HTML; `src/lib/richDocDiff.ts`
  compares two versions block by block. Nothing injects HTML: the card renders
  the blocks as React elements, so there is no sanitizer step
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.

# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:

```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.

- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.

## Landing Pages

You must always create good-looking designer-level styles to your application.

- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.

### Other Items to animate

- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.

## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead.

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.

## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```

## Common Convex Mistakes To Avoid

When using convex, make sure:

- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.
