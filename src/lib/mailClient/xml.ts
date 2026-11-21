import { XMLParser } from "fast-xml-parser";

/** Un nodo XML tal como lo entrega `fast-xml-parser`, sin `any`. */
export type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => name === "folder" || name === "m" || name === "e",
});

function isRecord(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Devuelve el nodo o `null` si el valor no es un objeto XML. */
export function asNode(value: unknown): XmlNode | null {
  return isRecord(value) ? value : null;
}

/** Normaliza un nodo que puede venir suelto o como lista. */
export function asArray<T>(value: T | readonly T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as T];
}

/** Primer nodo de un valor que puede venir suelto o como lista. */
export function firstNode(value: unknown): XmlNode | null {
  return (
    asArray(value)
      .map((item) => asNode(item))
      .find((node): node is XmlNode => node !== null) ?? null
  );
}

/** Extrae el texto de un nodo, de un array de nodos o de un atributo textual. */
export function readText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readText(item);
      if (text.length > 0) return text;
    }
    return "";
  }
  const node = asNode(value);
  return node ? readText(node["#text"]) : "";
}

/** Lee un atributo con el prefijo interno del parser. */
export function readAttr(node: XmlNode | null, name: string): string | null {
  if (!node) return null;
  const value = node[`@_${name}`];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/** Lee un atributo numérico; un valor ausente o inválido usa el fallback. */
export function readNumberAttr(
  node: XmlNode | null,
  name: string,
  fallback = 0,
): number {
  const raw = readAttr(node, name);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Parsea el XML y devuelve el nodo raíz. */
export function parseXml(xml: string): XmlNode {
  const parsed: unknown = parser.parse(xml);
  const root = asNode(parsed);
  if (!root) throw new Error("La respuesta XML está vacía o no es válida.");
  return root;
}

/** Devuelve el `Body` de un sobre SOAP, ya sin prefijos de namespace. */
export function parseSoapBody(xml: string): XmlNode {
  const root = parseXml(xml);
  const envelope = asNode(root["Envelope"]);
  const body = envelope ? asNode(envelope["Body"]) : null;
  if (!body) throw new Error("La respuesta SOAP no tiene Body.");
  return body;
}
