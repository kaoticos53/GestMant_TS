// Genera el par de claves RS256 que Convex Auth necesita para firmar y validar
// las sesiones (`JWT_PRIVATE_KEY` y `JWKS`).
//
// El CLI oficial `npx @convex-dev/auth` no soporta backends autoalojados, así
// que este script reproduce sus mismos pasos: es el script `generateKeys.mjs`
// de la guía manual de Convex Auth.
//
// Uso:
//   node scripts/generate-keys.mjs         # imprime las variables
//   node scripts/generate-keys.mjs --set   # las fija en el deployment
//
// Con --set hace `npx convex env set` contra el deployment que resuelva la CLI
// (en local, el backend de docker/convex vía .env.local). El valor va en un
// archivo temporal fuera del proyecto, porque el PEM empieza por "-" y el CLI
// lo interpretaría como una opción, y para no dejar la clave privada en disco.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

// Convex guarda el PEM en una sola línea: los saltos se sustituyen por espacios.
const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

if (!process.argv.includes("--set")) {
  // Formato listo para pegar en el panel del deployment.
  process.stdout.write(`JWT_PRIVATE_KEY="${jwtPrivateKey}"\n`);
  process.stdout.write(`JWKS=${jwks}\n`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "convex-keys-"));
const file = join(dir, "keys.env");
writeFileSync(
  file,
  `JWT_PRIVATE_KEY="${jwtPrivateKey}"\nJWKS=${jwks}\n`,
  { mode: 0o600 },
);

// La ruta del CLI se arma a mano: el paquete `convex` no expone `bin/main.js`
// en su mapa `exports`, así que no se puede resolver con require.resolve.
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const convexCli = join(projectRoot, "node_modules", "convex", "bin", "main.js");

if (!existsSync(convexCli)) {
  console.error(
    `No se encuentra el CLI de Convex en ${convexCli}.\n` +
      "Ejecuta `npm install` antes de generar las claves.",
  );
  process.exit(1);
}

try {
  // Se ejecuta el CLI con el propio Node del proyecto en vez de `npx`: así no
  // depende de la shell (ni de npx.cmd en Windows) y el valor del PEM nunca
  // pasa por la línea de comandos.
  const result = spawnSync(
    process.execPath,
    [convexCli, "env", "set", "--from-file", file, "--force"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("No se han podido fijar JWT_PRIVATE_KEY / JWKS.");
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("Claves de Convex Auth actualizadas en el deployment.");
