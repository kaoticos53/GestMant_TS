/**
 * Manuales del taller: negocio puro, sin base de datos ni interfaz.
 *
 * Un manual es una ficha de documentación de un equipo o de un modelo: o bien
 * el archivo que se carga (un PDF, casi siempre el manual del fabricante), o
 * bien una nota que escribe un técnico —un procedimiento, una observación—, que
 * vale por sí misma como manual. Cada ficha se clasifica por tipo, marca y
 * modelo, y puede apuntar a un equipo del inventario o quedarse suelta: hay
 * manuales sin equipo y equipos sin manuales, y ninguno de los dos es un error.
 *
 * Aquí vive lo que se puede decidir sin tocar nada: qué tipos existen, cómo se
 * compara una marca o un modelo, cómo se filtra la lista y quién puede editar o
 * borrar cada manual. Las mismas reglas las usan la interfaz (para enseñar los
 * botones que valen) y el backend (para no fiarse de la interfaz).
 */

/** Tipos con los que se clasifica un manual. El catálogo es cerrado: así la
 * clasificación no se fragmenta con sinónimos y los filtros sirven. */
export const MANUAL_TYPES = [
  "Manual de usuario",
  "Manual de servicio",
  "Ficha técnica",
  "Esquema y planos",
  "Guía rápida",
  "Procedimiento interno",
] as const;

export type ManualType = (typeof MANUAL_TYPES)[number];

/** Tipo con el que se abre el formulario de alta. */
export const DEFAULT_MANUAL_TYPE: ManualType = MANUAL_TYPES[0];

/** ¿Es uno de los tipos del catálogo? */
export function isManualType(value: string): value is ManualType {
  return (MANUAL_TYPES as readonly string[]).includes(value);
}

/**
 * Qué es un manual: el archivo que se carga o la nota que escribe un técnico.
 * La nota no lleva archivo y el archivo puede llevar además una nota.
 */
export type ManualKind = "file" | "note";

export const MANUAL_KIND_META: Record<
  ManualKind,
  { label: string; description: string; badgeClassName: string }
> = {
  file: {
    label: "Archivo",
    description:
      "Un documento subido al taller (PDF): el manual del fabricante o el que se digitalice.",
    badgeClassName: "border-sky-600/25 bg-sky-600/10 text-sky-700",
  },
  note: {
    label: "Nota del taller",
    description:
      "Lo que escribe un técnico sobre un modelo o un equipo: un procedimiento, una observación.",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/** Lo que el selector de archivos acepta: el manual se carga en PDF. */
export const MANUAL_ACCEPT = ".pdf,application/pdf";

/** Cómo se llama el formato en los textos que lo explican. */
export const MANUAL_FILE_FORMAT = "PDF";

/**
 * ¿Es un PDF? Vale el tipo que declara el navegador o la extensión del nombre:
 * hay navegadores que mandan el archivo sin tipo, y un PDF elegido desde el
 * móvil no siempre viene etiquetado.
 */
export function isPdfFile(file: {
  name?: string;
  contentType?: string;
}): boolean {
  const type = (file.contentType ?? "").toLowerCase();
  if (type.includes("pdf")) return true;
  return (file.name ?? "").toLowerCase().endsWith(".pdf");
}

/** El título que se propone a partir del nombre del archivo: sin extensión. */
export function manualTitleFromFile(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

/** Un tipo y un modelo se comparan sin acentos, sin mayúsculas y sin sobras. */
export function normalizeManualText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Lo mínimo que hay que saber de un manual para decidir sobre él. La fila
 * guardada lo cumple, y también la fila con la dirección del archivo que
 * devuelve la lista.
 */
export interface ManualLike {
  title: string;
  kind: ManualKind;
  type: string;
  brand?: string | null;
  model?: string | null;
  equipmentId?: string | null;
  fileName?: string | null;
  size?: number | null;
  storageId?: string | null;
  notes?: string | null;
  author?: string | null;
  authorId?: string | null;
}

/** Quién mira, para decidir qué puede hacer con un manual. */
export interface ManualRights {
  /** Puede gestionar el módulo (subir, cambiar y borrar cualquier manual). */
  manage: boolean;
  /** La persona que está mirando, si se sabe quién es. */
  userId?: string | null;
}

/** ¿Es suyo? Solo el autor de la nota puede corregirla sin ser responsable. */
function isAuthor(manual: ManualLike, rights: ManualRights): boolean {
  return (
    manual.authorId !== undefined &&
    manual.authorId !== null &&
    manual.authorId === (rights.userId ?? null)
  );
}

/** Modificar: quien gestiona, y el autor con lo que escribió él. */
export function canEditManual(
  manual: ManualLike,
  rights: ManualRights,
): boolean {
  return rights.manage || isAuthor(manual, rights);
}

/**
 * Borrar: quien gestiona cualquier manual; el autor, solo su nota. Un manual
 * con archivo se lleva el archivo consigo, así que no lo borra quien lo
 * consulta aunque lo hubiera subido él.
 */
export function canDeleteManual(
  manual: ManualLike,
  rights: ManualRights,
): boolean {
  return rights.manage || (manual.kind === "note" && isAuthor(manual, rights));
}

/** Un manual se enseña por su título; el archivo, con su nombre de fichero. */
export function manualFileName(manual: ManualLike): string | null {
  return manual.fileName?.trim() ? manual.fileName.trim() : null;
}

/* ------------------------------------------------------------------ */
/* Historial y versiones                                               */
/* ------------------------------------------------------------------ */

/**
 * Lo que se guarda del archivo que queda fuera al sustituir el de un manual:
 * lo justo para poder seguir descargándolo desde su ficha.
 */
export interface ManualFileVersion {
  storageId: string;
  fileName: string;
  contentType?: string | null;
  size: number;
}

/** Los movimientos que cuenta el historial de una ficha. */
export type ManualChangeAction = "created" | "edited" | "fileReplaced";

/**
 * Los campos de la ficha que un cambio puede tocar. El historial guarda su
 * clave —no su etiqueta—, así que la etiqueta se pone al contarlo y el catálogo
 * puede cambiar sin reescribir lo ya guardado.
 */
export const MANUAL_CHANGE_FIELDS = {
  title: "Título",
  type: "Tipo",
  brand: "Marca",
  model: "Modelo",
  equipment: "Equipo",
  notes: "Nota",
} as const;

export type ManualChangeField = keyof typeof MANUAL_CHANGE_FIELDS;

/** Las etiquetas de los campos que cambiaron, en el orden del catálogo. */
export function manualChangeLabels(
  fields: readonly string[] | null | undefined,
): string[] {
  const changed = fields ?? [];
  return (Object.keys(MANUAL_CHANGE_FIELDS) as ManualChangeField[])
    .filter((field) => changed.includes(field))
    .map((field) => MANUAL_CHANGE_FIELDS[field]);
}

/**
 * Lo mínimo que hay que saber de un movimiento del historial para contarlo. La
 * fila guardada lo cumple, y también la fila con la dirección de su archivo que
 * devuelve la lista.
 */
export interface ManualChangeLike {
  at: number;
  action: ManualChangeAction;
  by?: string | null;
  /** Claves de los campos que cambiaron (`MANUAL_CHANGE_FIELDS`). */
  fields?: readonly string[] | null;
  /** El archivo que quedó fuera al sustituirlo, si el movimiento lo hizo. */
  file?: ManualFileVersion | null;
}

/**
 * El historial de una ficha, del movimiento más reciente al más antiguo. El
 * historial guardado crece por el final, así que el desempate —dos movimientos
 * en el mismo instante, que es lo normal al corregir nada más crear— lo
 * resuelve el orden en que se guardaron.
 */
export function manualHistory<T extends ManualChangeLike>(manual: {
  history?: readonly T[] | null;
}): T[] {
  return (manual.history ?? [])
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.at - a.entry.at || b.index - a.index)
    .map((item) => item.entry);
}

/**
 * Las versiones anteriores del archivo, de la sustituida en último lugar a la
 * primera. Cada una se puede descargar: sustituir un PDF no lo borra, lo deja
 * guardado en el historial de la ficha.
 */
export function manualFileVersions<T extends ManualChangeLike>(manual: {
  history?: readonly T[] | null;
}): T[] {
  return manualHistory(manual).filter(
    (entry) => entry.action === "fileReplaced" && entry.file != null,
  );
}

/** Cómo se cuenta un movimiento del historial en una línea. */
export function manualChangeSummary(
  entry: ManualChangeLike,
  kind: ManualKind,
): string {
  const labels = manualChangeLabels(entry.fields);
  if (entry.action === "created") {
    return kind === "file"
      ? "Se subió el archivo del manual"
      : "Se escribió la nota del taller";
  }
  if (entry.action === "fileReplaced") {
    return labels.length > 0
      ? `Se sustituyó el archivo y cambió: ${labels.join(", ")}`
      : "Se sustituyó el archivo; la versión anterior queda guardada";
  }
  return labels.length > 0
    ? `Cambió: ${labels.join(", ")}`
    : "Se corrigió la ficha";
}

/** El estado de la ficha en los campos que un cambio puede tocar. */
export interface ManualChangeState {
  title?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  equipmentId?: string | null;
  notes?: string | null;
}

/**
 * Los campos que cambian de un estado a otro. Marca, modelo y tipo se comparan
 * como se comparan los filtros —sin acentos ni mayúsculas—; la nota, tal cual,
 * porque una corrección de una letra es una corrección.
 */
export function changedManualFields(
  before: ManualChangeState,
  after: ManualChangeState,
): ManualChangeField[] {
  const sameText = (
    a: string | null | undefined,
    b: string | null | undefined,
  ) => normalizeManualText(a) === normalizeManualText(b);
  const fields: ManualChangeField[] = [];
  if (!sameText(before.title, after.title)) fields.push("title");
  if (!sameText(before.type, after.type)) fields.push("type");
  if (!sameText(before.brand, after.brand)) fields.push("brand");
  if (!sameText(before.model, after.model)) fields.push("model");
  if ((before.equipmentId ?? null) !== (after.equipmentId ?? null)) {
    fields.push("equipment");
  }
  if ((before.notes ?? "") !== (after.notes ?? "")) fields.push("notes");
  return fields;
}

/** Estado de la lista: qué se enseña y qué no. */
export interface ManualFilters {
  /** Texto libre: título, tipo, marca, modelo, archivo y nota. */
  query?: string;
  type?: string;
  brand?: string;
  model?: string;
  /** Un equipo concreto del inventario (su ficha lo usa). */
  equipmentId?: string;
}

/**
 * Aplica los filtros de la lista. Los de marca y modelo comparan sin acentos ni
 * mayúsculas —«Hakko» encuentra «hakko»— y el de tipo es exacto, porque el
 * catálogo es cerrado.
 */
export function filterManuals<T extends ManualLike>(
  manuals: readonly T[],
  filters: ManualFilters = {},
): T[] {
  const query = normalizeManualText(filters.query);
  return manuals.filter((manual) => {
    if (filters.type && manual.type !== filters.type) return false;
    if (
      filters.brand &&
      normalizeManualText(manual.brand) !== normalizeManualText(filters.brand)
    ) {
      return false;
    }
    if (
      filters.model &&
      normalizeManualText(manual.model) !== normalizeManualText(filters.model)
    ) {
      return false;
    }
    if (
      filters.equipmentId &&
      (manual.equipmentId ?? null) !== filters.equipmentId
    ) {
      return false;
    }
    if (!query) return true;
    return searchText(manual).includes(query);
  });
}

/** Todo lo que se busca de un manual, en texto plano y normalizado. */
function searchText(manual: ManualLike): string {
  return normalizeManualText(
    [
      manual.title,
      manual.type,
      manual.brand ?? "",
      manual.model ?? "",
      manual.fileName ?? "",
      manual.notes ?? "",
      manual.author ?? "",
    ].join(" \n "),
  );
}

/** Orden de la lista: por título, que es como se busca uno a mano. */
export function sortManuals<T extends ManualLike>(manuals: readonly T[]): T[] {
  return [...manuals].sort((a, b) => a.title.localeCompare(b.title, "es"));
}

/** Las marcas que hay entre los manuales, sin repetir y ordenadas. */
export function manualBrands(manuals: readonly ManualLike[]): string[] {
  const brands = new Map<string, string>();
  for (const manual of manuals) {
    const brand = manual.brand?.trim();
    if (brand) brands.set(normalizeManualText(brand), brand);
  }
  return [...brands.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** Los modelos que hay entre los manuales (de una marca, si se pide). */
export function manualModels(
  manuals: readonly ManualLike[],
  brand?: string,
): string[] {
  const models = new Map<string, string>();
  for (const manual of manuals) {
    if (
      brand &&
      normalizeManualText(manual.brand) !== normalizeManualText(brand)
    ) {
      continue;
    }
    const model = manual.model?.trim();
    if (model) models.set(normalizeManualText(model), model);
  }
  return [...models.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Lo mínimo que hay que saber de un equipo para clasificar un manual suyo.
 * Cualquier equipo del inventario lo cumple.
 */
export interface ClassifiableEquipment {
  _id: string;
  brand?: string | null;
  model?: string | null;
}

/**
 * La clasificación con la que se guarda un manual: la marca y el modelo de un
 * manual asignado a un equipo salen de la ficha del equipo —es lo que hace que
 * el manual aparezca también en ella, porque `manualsForEquipment` compara
 * marca y modelo—, y los de un manual suelto, de lo que se haya escrito.
 *
 * La regla la aplica igual el backend al guardar, así que la ficha guardada dice
 * lo mismo que enseña el formulario: elegir equipo manda sobre lo escrito.
 */
export function manualClassification<T extends ClassifiableEquipment>(
  equipment: readonly T[],
  fields: {
    equipmentId?: string | null;
    brand?: string | null;
    model?: string | null;
  },
): { linked: T | null; brand: string; model: string } {
  const linked =
    equipment.find((item) => item._id === fields.equipmentId) ?? null;
  if (linked) {
    return {
      linked,
      brand: (linked.brand ?? "").trim(),
      model: (linked.model ?? "").trim(),
    };
  }
  return {
    linked: null,
    brand: (fields.brand ?? "").trim(),
    model: (fields.model ?? "").trim(),
  };
}

/**
 * Los manuales de un equipo: los que tiene asignados y, además, los que son de
 * su modelo sin estar asignados a él —los del modelo sirven para cualquier
 * equipo del mismo modelo, y es lo que hace útil la clasificación—. Los
 * asignados no se repiten entre los dos grupos.
 */
export function manualsForEquipment<T extends ManualLike>(
  manuals: readonly T[],
  equipment: { _id: string; brand?: string | null; model?: string | null },
): { assigned: T[]; byModel: T[] } {
  const assigned = sortManuals(
    manuals.filter((manual) => (manual.equipmentId ?? null) === equipment._id),
  );
  const assignedIds = new Set(assigned.map((manual) => manual));
  const byModel = sortManuals(
    manuals.filter(
      (manual) =>
        !assignedIds.has(manual) && isManualOfModel(manual, equipment),
    ),
  );
  return { assigned, byModel };
}

/**
 * ¿Es este manual del modelo del equipo?
 *
 * Hace falta que el manual **declare el modelo**: uno sin modelo no es de ningún
 * modelo, así que no cuelga de ninguna ficha —de la suya no, porque no está
 * asignado, y de las demás tampoco, porque no dice de qué son—. Antes bastaba
 * con que el modelo del equipo estuviera puesto, y un manual sin marca ni modelo
 * acababa apareciendo en *todos* los equipos del taller como si fuera de su
 * modelo.
 *
 * La marca, en cambio, sí puede faltar: los manuales de un procedimiento interno
 * muchas veces no la declaran, y basta con que coincida el modelo. Cuando la
 * declara, tiene que ser la del equipo.
 */
function isManualOfModel(
  manual: ManualLike,
  equipment: { brand?: string | null; model?: string | null },
): boolean {
  const model = normalizeManualText(manual.model);
  if (!model || model !== normalizeManualText(equipment.model)) return false;
  const brand = normalizeManualText(manual.brand);
  return brand === "" || brand === normalizeManualText(equipment.brand);
}

/**
 * De dónde es un manual que no está asignado a un equipo: del modelo —sirve
 * para cualquiera de ese modelo—, de una marca sin modelo, o suelto. Es la
 * misma frase en la ficha del manual y en el documento que se exporta, y habla
 * de «equipos», como el filtro del módulo y el campo del formulario: un manual
 * del modelo no cuelga de ningún equipo, y uno suelto tampoco.
 */
export function manualScopeLabel(manual: {
  brand?: string | null;
  model?: string | null;
}): string {
  const brand = manual.brand?.trim() ?? "";
  const model = manual.model?.trim() ?? "";
  if (model) {
    return brand
      ? `Del modelo: vale para cualquier equipo ${brand} ${model}`
      : "Del modelo: vale para cualquier equipo de ese modelo";
  }
  if (brand) {
    return "De la marca, sin modelo: no cuelga de ningún equipo";
  }
  return "Sin equipo asignado";
}

/** Cuántos manuales tiene un equipo (asignados o de su modelo). */
export function manualCountForEquipment(
  manuals: readonly ManualLike[],
  equipment: { _id: string; brand?: string | null; model?: string | null },
): number {
  const { assigned, byModel } = manualsForEquipment(manuals, equipment);
  return assigned.length + byModel.length;
}
