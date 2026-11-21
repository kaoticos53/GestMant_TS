import {
  asArray,
  asNode,
  parseSoapBody,
  readAttr,
  readNumberAttr,
} from "./xml";
import type { MailFolder } from "./types";

/**
 * Cuando `view` falta, el nombre es la única pista. Solo se excluyen los tipos
 * que la referencia identifica como no-correo; Trash y Personales sí son correo.
 */
const NON_MAIL_NAME_PATTERNS: readonly RegExp[] = [
  /^USER_ROOT$/i,
  /^fuentes rss$/i,
  /^rss\b/i,
  /^briefcase$/i,
  /^presupuestos$/i,
  /^notes$/i,
  /^files shared$/i,
  /^calendar$/i,
  /^contacts$/i,
  /^emailed contacts$/i,
  /^tasks$/i,
];

/** ¿Esta carpeta pertenece al buzón de correo? */
export function isMailFolder(input: {
  name: string;
  kind?: string | null;
}): boolean {
  const kind = input.kind?.trim().toLowerCase() ?? "";
  if (kind === "message") return true;
  if (kind.length > 0) return false;

  const name = input.name.trim();
  if (name.length === 0) return false;
  return !NON_MAIL_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function appendPath(parentPath: string, name: string): string {
  if (name.length === 0) return parentPath;
  return parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
}

function visitFolder(
  value: unknown,
  parentRemoteId: string | null,
  parentPath: string,
  folders: MailFolder[],
): void {
  const node = asNode(value);
  if (!node) return;
  const remoteId = readAttr(node, "id");
  if (!remoteId) return;

  const name = readAttr(node, "name") ?? "";
  const kind = readAttr(node, "view");
  const path = readAttr(node, "absFolderPath") ?? appendPath(parentPath, name);
  folders.push({
    remoteId,
    parentRemoteId,
    name,
    path,
    kind,
    isMail: isMailFolder({ name, kind }),
    unread: readNumberAttr(node, "u"),
    total: readNumberAttr(node, "n"),
    size: readNumberAttr(node, "s"),
    sortOrder: folders.length,
  });

  for (const child of asArray(node["folder"])) {
    visitFolder(child, remoteId, path, folders);
  }
}

/** Parsea el árbol completo, incluidas las carpetas que no son correo. */
export function parseFolderTree(xml: string): MailFolder[] {
  const body = parseSoapBody(xml);
  const response = asNode(body["GetFolderResponse"]);
  if (!response) throw new Error("La respuesta no es un GetFolderResponse.");

  const folders: MailFolder[] = [];
  for (const root of asArray(response["folder"])) {
    visitFolder(root, null, "/", folders);
  }
  return folders;
}

/** Parsea y deja solo las carpetas que pueden contener mensajes. */
export function parseMailFolders(xml: string): MailFolder[] {
  return parseFolderTree(xml).filter((folder) => folder.isMail);
}
