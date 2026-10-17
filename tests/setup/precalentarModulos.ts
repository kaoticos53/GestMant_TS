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
 * Cargarlos aquí mueve ese coste a donde le toca: se ejecuta antes de las
 * pruebas —así el primer test encuentra los módulos ya evaluados y su tiempo es
 * el suyo— y no toca ningún plazo. La carga sigue ocurriendo una vez por
 * archivo, porque cada archivo recibe un entorno nuevo; lo que cambia es a quién
 * se le cobra.
 */
const modulos = import.meta.glob("../../src/convex/**/!(*.*.*)*.*s");

await Promise.all(Object.values(modulos).map((cargar) => cargar()));

export {};
