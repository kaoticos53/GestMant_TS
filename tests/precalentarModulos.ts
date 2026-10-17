/**
 * El grafo de funciones de Convex, cargado antes de que empiecen las pruebas.
 *
 * Media docena de archivos de prueba fallaban por «Test timed out in 5000ms» al
 * correr la suite entera, y siempre el mismo test: el primero del archivo. No
 * eran lentos —en solitario tardan milisegundos—, sino que el primero de cada
 * archivo pagaba la carga perezosa de `import.meta.glob("../src/convex/**")`,
 * que es transformar y evaluar las decenas de módulos del backend. Ese trabajo
 * es del arnés, no de la prueba, y con veintisiete procesos compitiendo por la
 * misma CPU se estiraba por encima de los cinco segundos y hacía fallar al
 * primero que lo tocaba: el archivo que fallaba cambiaba de una corrida a otra.
 *
 * Cargarlo aquí —y esperarlo— mueve ese coste a donde le toca: quien importa
 * este archivo lo paga al evaluarse, antes de sus pruebas, así que el primer test
 * encuentra los módulos ya puestos y su tiempo es el suyo. No se toca ningún
 * plazo.
 *
 * Se importa **solo en los archivos que levantan el backend** (`convexTest`), y
 * por eso no vive en `setupFiles`: puesto ahí lo pagan los ciento ocho archivos
 * de prueba, ochenta de ellos sin tocar Convex y muchos dentro del entorno de
 * jsdom, donde cargar el backend cuesta más y no sirve para nada. Que la lista de
 * quien lo importa siga completa lo vigila `tests/suiteEstable.test.ts`.
 */
const modulos = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

await Promise.all(Object.values(modulos).map((cargar) => cargar()));

export {};
