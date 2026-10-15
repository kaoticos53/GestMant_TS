import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { DEFAULT_AFTER_MONTHS } from "../lib/archive";
import { monthsAgo } from "../lib/browse";
import {
  PART_CATEGORIES,
  type IncidentStatus,
  type Priority,
  type RequestStatus,
} from "../lib/workshop";
import { SAMPLE_PHOTOS, samplePhotoBytes } from "../lib/samplePhotos";
import { SAMPLE_MANUALS, sampleManualPdf } from "../lib/sampleManuals";
import { PUBLIC_CODE_LENGTH, publicCodeFrom } from "../lib/publicCode";
import { richDocToStore } from "../lib/richDoc";
import { formatReference, nextSequence } from "../lib/references";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  MutationCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { AUTO_ARCHIVE_BY } from "./archive";
import { hasCapability, roleCan } from "./permissions";
import { DEFAULT_ROLE } from "../lib/roles";
import { DOCUMENT_ACTIONS, ROLES } from "./schema";

/**
 * Datos de ejemplo del taller. Se cargan de una vez con `seedDemoData` (una
 * sola vez por instalación) y se pueden ampliar con `seedMoreDemoData`, que
 * añade otra tanda de incidencias, peticiones e intervenciones. Todo se genera
 * de forma determinista a partir de una semilla, así que dos instalaciones
 * parecidas tienen datos parecidos y las comprobaciones son repetibles.
 *
 * Las fotos abandonadas del formulario público van aparte, en
 * `seedDemoUploads`: guardarlas es escribir en el almacén, y eso solo se puede
 * hacer desde una acción, no desde la mutación que carga la muestra.
 */

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;

type PartCategory = (typeof PART_CATEGORIES)[number];
type EquipmentKind =
  | "camara"
  | "audio"
  | "video"
  | "red"
  | "energia"
  | "iluminacion"
  | "informatica"
  | "mecanica";

/** Cuánto trae la primera carga (además de la muestra curada). */
const INITIAL_INCIDENTS = 120;
const INITIAL_REQUESTS = 100;
/** Cuánto añade cada pulsación de «Más datos de ejemplo». */
const MORE_INCIDENTS = 60;
const MORE_REQUESTS = 50;

/* ------------------------------------------------------------------ */
/* Azar reproducible                                                   */
/* ------------------------------------------------------------------ */

/** Generador pseudoaleatorio (mulberry32): misma semilla, mismos datos. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rnd: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rnd() * items.length)];
  if (item === undefined) throw new ConvexError("Datos de ejemplo vacíos.");
  return item;
}

/** Fecha de hace `months` meses (para antigüedades calculadas). */
function monthsBack(months: number, now: number): number {
  const date = new Date(now);
  date.setMonth(date.getMonth() - months);
  return date.getTime();
}

/** Una fecha más `months` meses (garantías y planes de mantenimiento). */
function addMonths(timestamp: number, months: number): number {
  return monthsBack(-months, timestamp);
}

/* ------------------------------------------------------------------ */
/* Catálogo de repuestos                                               */
/* ------------------------------------------------------------------ */

interface SeedPart {
  code: string;
  name: string;
  description: string;
  category: PartCategory;
  unit: string;
  stock: number;
  minStock: number;
  location: string;
  supplier: string;
  partNumber?: string;
  unitPrice?: number;
  /** Códigos de equipo compatibles (los repuestos extra lo llevan aquí). */
  compatibleWith?: string[];
}

/** Repuestos de ejemplo para el almacén audiovisual de la cadena. */
const SEED_PARTS: SeedPart[] = [
  {
    code: "ALI-24015",
    name: "Fuente de alimentación 24 V 150 W",
    description:
      "Fuente conmutada 24 V DC / 6,25 A para racks y alimentación de cámaras.",
    category: "Alimentación",
    unit: "ud",
    stock: 4,
    minStock: 6,
    location: "A-03",
    supplier: "Mean Well",
    partNumber: "NDR-150-24",
    unitPrice: 38.9,
  },
  {
    code: "BAT-19001",
    name: "Batería V-Mount 190 Wh",
    description:
      "Batería de plato V-Mount 190 Wh, 14,4 V, con telemetría de carga.",
    category: "Alimentación",
    unit: "ud",
    stock: 6,
    minStock: 8,
    location: "B-01",
    supplier: "Anton Bauer",
    partNumber: "ION-190",
    unitPrice: 349,
  },
  {
    code: "VID-SDI30",
    name: "Cable SDI 12G 30 m",
    description:
      "Coaxial 75 Ω certificado 12G-SDI, 30 m con conectores BNC montados.",
    category: "Conectividad",
    unit: "ud",
    stock: 12,
    minStock: 6,
    location: "C-01",
    supplier: "Belden",
    partNumber: "1694A-30",
    unitPrice: 64.5,
  },
  {
    code: "VID-BNC01",
    name: "Conector BNC 75 Ω de campo",
    description:
      "Conector BNC 75 Ω para cable RG-6, montaje en campo sin soldadura.",
    category: "Conectividad",
    unit: "ud",
    stock: 40,
    minStock: 25,
    location: "C-02",
    supplier: "Canare",
    partNumber: "BNC-L6.5",
    unitPrice: 3.4,
  },
  {
    code: "VID-CAR04",
    name: "Tarjeta de salida SDI 4K",
    description:
      "Tarjeta de salida 12G-SDI 4K para el conmutador de realización.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 0,
    minStock: 1,
    location: "A-07",
    supplier: "Ross Video",
    partNumber: "CC-12G-OUT",
    unitPrice: 1250,
  },
  {
    code: "CAM-FIL09",
    name: 'Filtro ND 0,9 · 4×5,65"',
    description:
      "Filtro neutro 0,9 para portafiltros de cámara, 4×5,65 pulgadas.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 5,
    minStock: 3,
    location: "B-05",
    supplier: "Tiffen",
    partNumber: "ND9-4565",
    unitPrice: 89,
  },
  {
    code: "CAM-VF01",
    name: 'Visor OLED 0,5" para cámara',
    description: "Visor de repuesto 0,5 pulgadas OLED para cámara de hombro.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 2,
    minStock: 1,
    location: "B-04",
    supplier: "Sony",
    partNumber: "VF-OLED05",
    unitPrice: 430,
  },
  {
    code: "AUD-XLR10",
    name: "Cable XLR balanceado 10 m",
    description:
      "Cable de microfonía balanceado XLR macho-hembra, 10 m, apantallado.",
    category: "Audio",
    unit: "ud",
    stock: 14,
    minStock: 8,
    location: "C-04",
    supplier: "Klotz",
    partNumber: "MY10XLR",
    unitPrice: 21.9,
  },
  {
    code: "AUD-CAP02",
    name: "Cápsula de micrófono de solapa",
    description:
      "Cápsula omnidireccional de repuesto para micro de solapa inalámbrico.",
    category: "Audio",
    unit: "ud",
    stock: 8,
    minStock: 6,
    location: "C-05",
    supplier: "Sennheiser",
    partNumber: "MKE-2",
    unitPrice: 189,
  },
  {
    code: "AUD-AUR01",
    name: "Auricular de realización",
    description: "Auricular mono de diadema para los puestos de realización.",
    category: "Audio",
    unit: "ud",
    stock: 5,
    minStock: 3,
    location: "C-06",
    supplier: "Beyerdynamic",
    partNumber: "DT-108",
    unitPrice: 119,
  },
  {
    code: "ILU-LED60",
    name: "Panel LED 60 W bicolor",
    description: "Panel LED de plató 60 W con temperatura de color variable.",
    category: "Iluminación",
    unit: "ud",
    stock: 3,
    minStock: 4,
    location: "D-01",
    supplier: "ARRI",
    partNumber: "SKY-60-BI",
    unitPrice: 1890,
  },
  {
    code: "ILU-LAM12",
    name: "Lámpara de foco 100 W LED",
    description:
      "Lámpula LED 100 W 3200 K para foco de plató, casquillo GX5,3.",
    category: "Iluminación",
    unit: "ud",
    stock: 10,
    minStock: 6,
    location: "D-02",
    supplier: "ARRI",
    partNumber: "LED-100-32",
    unitPrice: 74.5,
  },
  {
    code: "VEN-08012",
    name: "Ventilador axial 80 mm 12 V",
    description:
      "Ventilador de rack 80×80×25 mm, 12 V DC, rodamiento de bolas.",
    category: "Mecánica",
    unit: "ud",
    stock: 6,
    minStock: 6,
    location: "E-02",
    supplier: "ebm-papst",
    partNumber: "8414NH3",
    unitPrice: 18.7,
  },
  {
    code: "LIM-70014",
    name: "Limpiador de contactos 200 ml",
    description: "Aerosol de limpieza de contactos electrónicos y conectores.",
    category: "Consumibles",
    unit: "ud",
    stock: 9,
    minStock: 6,
    location: "D-04",
    supplier: "Kontakt Chemie",
    partNumber: "CK-200",
    unitPrice: 7.25,
  },
  {
    code: "HER-90003",
    name: "Pinza de precisión ESD",
    description: "Pinza antiestática de punta fina para trabajo en tarjetas.",
    category: "Herramientas",
    unit: "ud",
    stock: 7,
    minStock: 4,
    location: "F-01",
    supplier: "Wera",
    unitPrice: 12.5,
  },
];

/** Compatibilidad repuesto → equipos (los repuestos curados la llevan aquí). */
const COMPATIBILITY: Record<string, string[]> = {
  "ALI-24015": ["EQ-001", "EQ-004"],
  "BAT-19001": ["EQ-001"],
  "VID-SDI30": ["EQ-003", "EQ-004"],
  "VID-BNC01": ["EQ-003", "EQ-004", "EQ-006"],
  "VID-CAR04": ["EQ-003"],
  "CAM-FIL09": ["EQ-001"],
  "CAM-VF01": ["EQ-001"],
  "AUD-XLR10": ["EQ-002", "EQ-003"],
  "AUD-CAP02": ["EQ-001"],
  "AUD-AUR01": ["EQ-002", "EQ-003"],
  "ILU-LED60": ["EQ-005"],
  "ILU-LAM12": ["EQ-005"],
  "VEN-08012": ["EQ-004", "EQ-006"],
  "LIM-70014": ["EQ-001", "EQ-006"],
  "HER-90003": [],
};

/** Repuestos de reposición: completan el almacén hasta las 8 categorías. */
const EXTRA_PARTS: SeedPart[] = [
  {
    code: "VID-SDI15",
    name: "Cable SDI 12G 15 m",
    description: "Coaxial 75 Ω certificado 12G-SDI, 15 m con BNC montados.",
    category: "Conectividad",
    unit: "ud",
    stock: 9,
    minStock: 6,
    location: "C-01",
    supplier: "Belden",
    partNumber: "1694A-15",
    unitPrice: 38.2,
    compatibleWith: ["EQ-003", "EQ-004"],
  },
  {
    code: "VID-HDM20",
    name: "Cable HDMI óptico 20 m",
    description:
      "Cable HDMI activo con fibra óptica, 20 m, para puestos de grafismo.",
    category: "Conectividad",
    unit: "ud",
    stock: 4,
    minStock: 4,
    location: "C-03",
    supplier: "Kramer",
    partNumber: "CLS-AOCH-20",
    unitPrice: 112,
    compatibleWith: ["EQ-003", "EQ-020"],
  },
  {
    code: "VID-FIB10",
    name: "Latiguillo de fibra LC 10 m",
    description: "Latiguillo monomodo LC-LC de 10 m para el rack central.",
    category: "Conectividad",
    unit: "ud",
    stock: 12,
    minStock: 8,
    location: "C-07",
    supplier: "Neutrik",
    partNumber: "NFO-LC-10",
    unitPrice: 27.5,
    compatibleWith: ["EQ-004", "EQ-013"],
  },
  {
    code: "VID-SFP10",
    name: "Módulo SFP+ 10G SR",
    description: "Óptica SFP+ de 10 Gbps para los enlaces del rack central.",
    category: "Conectividad",
    unit: "ud",
    stock: 3,
    minStock: 6,
    location: "A-09",
    supplier: "Cisco",
    partNumber: "SFP-10G-SR",
    unitPrice: 168,
    compatibleWith: ["EQ-016"],
  },
  {
    code: "CAM-BAT90",
    name: "Batería de plato V-Mount 98 Wh",
    description: "Batería compacta 98 Wh para cámaras de hombro y ENG.",
    category: "Alimentación",
    unit: "ud",
    stock: 7,
    minStock: 6,
    location: "B-02",
    supplier: "IDX",
    partNumber: "DUO-C98",
    unitPrice: 249,
    compatibleWith: ["EQ-007", "EQ-008"],
  },
  {
    code: "CAM-OPT62",
    name: "Tapa de objetivo 62 mm",
    description:
      "Tapa frontal de 62 mm con cordón para las ópticas de estudio.",
    category: "Consumibles",
    unit: "ud",
    stock: 6,
    minStock: 4,
    location: "D-05",
    supplier: "Canon",
    partNumber: "LC-62",
    unitPrice: 9.9,
    compatibleWith: ["EQ-009"],
  },
  {
    code: "AUD-XLR03",
    name: "Cable XLR 3 m",
    description: "Cable de microfonía XLR macho-hembra de 3 m.",
    category: "Audio",
    unit: "ud",
    stock: 18,
    minStock: 10,
    location: "C-04",
    supplier: "Klotz",
    partNumber: "MY3XLR",
    unitPrice: 14.2,
    compatibleWith: ["EQ-011", "EQ-012"],
  },
  {
    code: "AUD-POP01",
    name: "Antiviento de micrófono de caña",
    description: "Antiviento con peluche para caña de exterior.",
    category: "Audio",
    unit: "ud",
    stock: 4,
    minStock: 3,
    location: "D-06",
    supplier: "Rycote",
    partNumber: "WS-4",
    unitPrice: 79,
    compatibleWith: ["EQ-022"],
  },
  {
    code: "AUD-PIL02",
    name: "Pilas AA recargables (par)",
    description:
      "Par de pilas AA de níquel-metal hidruro de baja autodescarga.",
    category: "Alimentación",
    unit: "par",
    stock: 22,
    minStock: 12,
    location: "D-03",
    supplier: "Panasonic",
    partNumber: "ENELOOP-AA",
    unitPrice: 11.5,
    compatibleWith: ["EQ-010", "EQ-012"],
  },
  {
    code: "AUD-JACK01",
    name: "Latiguillo jack 6,3 mm 2 m",
    description: "Latiguillo de audio jack 6,3 mm mono de 2 m.",
    category: "Audio",
    unit: "ud",
    stock: 0,
    minStock: 6,
    location: "C-08",
    supplier: "Neutrik",
    partNumber: "NP2X-2",
    unitPrice: 12.8,
    compatibleWith: ["EQ-011"],
  },
  {
    code: "ILU-DMX05",
    name: "Cable DMX 5 m",
    description: "Cable DMX 512 de 5 m con conectores XLR de 5 pines.",
    category: "Conectividad",
    unit: "ud",
    stock: 11,
    minStock: 6,
    location: "D-07",
    supplier: "Eurolite",
    partNumber: "DMX-5",
    unitPrice: 16.4,
    compatibleWith: ["EQ-005", "EQ-023"],
  },
  {
    code: "ILU-BAL01",
    name: "Balasto LED 100 W",
    description: "Driver/balasto de repuesto para focos LED de plató.",
    category: "Iluminación",
    unit: "ud",
    stock: 3,
    minStock: 2,
    location: "D-08",
    supplier: "ARRI",
    partNumber: "BAL-100",
    unitPrice: 168,
    compatibleWith: ["EQ-005", "EQ-023"],
  },
  {
    code: "ILU-DIF01",
    name: "Difusor de panel 60×60",
    description: "Difusor textil de 60×60 cm para paneles LED.",
    category: "Iluminación",
    unit: "ud",
    stock: 5,
    minStock: 3,
    location: "D-09",
    supplier: "ARRI",
    partNumber: "DIFF-6060",
    unitPrice: 96,
    compatibleWith: ["EQ-005"],
  },
  {
    code: "MEC-CAST",
    name: 'Rueda de trípode 3/8"',
    description: "Juego de ruedas con freno para trípode de estudio.",
    category: "Mecánica",
    unit: "ud",
    stock: 6,
    minStock: 3,
    location: "F-05",
    supplier: "Manfrotto",
    partNumber: "100G",
    unitPrice: 18,
    compatibleWith: ["EQ-024"],
  },
  {
    code: "MEC-PINZA",
    name: "Pinza de plató con pasador",
    description: "Pinza de agarre para tubo y estructura de plató.",
    category: "Mecánica",
    unit: "ud",
    stock: 9,
    minStock: 6,
    location: "F-04",
    supplier: "Manfrotto",
    partNumber: "035",
    unitPrice: 29.9,
    compatibleWith: [],
  },
  {
    code: "VID-MON24",
    name: 'Monitor de realización 24"',
    description: "Monitor de 24 pulgadas con entradas 12G-SDI y HDMI.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 2,
    minStock: 4,
    location: "B-07",
    supplier: "Barco",
    partNumber: "MDSC-8424",
    unitPrice: 2450,
    compatibleWith: ["EQ-003", "EQ-020"],
  },
  {
    code: "VID-SPL02",
    name: "Distribuidor SDI 1×4",
    description:
      "Repartidor de señal SDI con reclocking, 1 entrada y 4 salidas.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 1,
    minStock: 2,
    location: "A-08",
    supplier: "Blackmagic",
    partNumber: "SPL-1X4",
    unitPrice: 320,
    compatibleWith: ["EQ-004", "EQ-013"],
  },
  {
    code: "VID-TAR4K",
    name: "Tarjeta de entrada 12G-SDI",
    description:
      "Tarjeta de entrada 12G-SDI para el conmutador de realización.",
    category: "Vídeo y cámaras",
    unit: "ud",
    stock: 1,
    minStock: 1,
    location: "A-07",
    supplier: "Ross Video",
    partNumber: "CC-12G-IN",
    unitPrice: 1180,
    compatibleWith: ["EQ-003"],
  },
  {
    code: "RED-PATCH",
    name: "Panel de parcheo 6A 24 puertos",
    description: "Panel de parcheo categoría 6A de 24 puertos para el rack.",
    category: "Conectividad",
    unit: "ud",
    stock: 2,
    minStock: 2,
    location: "E-01",
    supplier: "Panduit",
    partNumber: "CP24-6A",
    unitPrice: 178,
    compatibleWith: ["EQ-016"],
  },
  {
    code: "RED-ANALI",
    name: "Analizador de red portátil",
    description: "Comprobador de cableado y red para los enlaces de control.",
    category: "Herramientas",
    unit: "ud",
    stock: 1,
    minStock: 1,
    location: "F-02",
    supplier: "Fluke",
    partNumber: "LRAT-2000",
    unitPrice: 1240,
    compatibleWith: ["EQ-016"],
  },
  {
    code: "ENE-SAI01",
    name: "Batería de SAI 12 V 9 Ah",
    description: "Batería de repuesto para el SAI del rack central.",
    category: "Alimentación",
    unit: "ud",
    stock: 4,
    minStock: 4,
    location: "E-03",
    supplier: "APC",
    partNumber: "RBC-9",
    unitPrice: 89,
    compatibleWith: ["EQ-017"],
  },
  {
    code: "ENE-VENT12",
    name: "Ventilador de rack 120 mm",
    description: "Ventilador de 120 mm a 230 V para el fondo del rack.",
    category: "Mecánica",
    unit: "ud",
    stock: 5,
    minStock: 3,
    location: "E-02",
    supplier: "ebm-papst",
    partNumber: "4650N",
    unitPrice: 42,
    compatibleWith: ["EQ-004", "EQ-017"],
  },
  {
    code: "CON-ALCO2",
    name: "Alcohol isopropílico 250 ml",
    description: "Alcohol isopropílico para limpieza de contactos y ópticas.",
    category: "Consumibles",
    unit: "ud",
    stock: 12,
    minStock: 6,
    location: "D-04",
    supplier: "Kontakt Chemie",
    partNumber: "IPA-250",
    unitPrice: 9.4,
    compatibleWith: ["EQ-015"],
  },
  {
    code: "CON-GUANT",
    name: "Guantes antiestáticos (caja de 100)",
    description: "Guantes de nitrilo antiestáticos para manipular tarjetas.",
    category: "Consumibles",
    unit: "caja",
    stock: 3,
    minStock: 3,
    location: "D-10",
    supplier: "RS Pro",
    partNumber: "ESD-100",
    unitPrice: 22,
    compatibleWith: [],
  },
  {
    code: "CON-VELCR",
    name: "Bridas y velcro para cableado",
    description:
      "Rollo de velcro y bridas reutilizables para el cableado de plató.",
    category: "Consumibles",
    unit: "ud",
    stock: 25,
    minStock: 15,
    location: "D-11",
    supplier: "HellermannTyton",
    partNumber: "VEL-20",
    unitPrice: 6.8,
    compatibleWith: [],
  },
  {
    code: "HER-TES01",
    name: "Multímetro de mano",
    description: "Multímetro de mano con medida de continuidad y capacitancia.",
    category: "Herramientas",
    unit: "ud",
    stock: 2,
    minStock: 2,
    location: "F-06",
    supplier: "Fluke",
    partNumber: "117",
    unitPrice: 189,
    compatibleWith: [],
  },
  {
    code: "HER-SOLD1",
    name: "Estación de soldadura 60 W",
    description:
      "Estación de soldadura con control de temperatura para el banco.",
    category: "Herramientas",
    unit: "ud",
    stock: 1,
    minStock: 1,
    location: "F-07",
    supplier: "Weller",
    partNumber: "WE1010",
    unitPrice: 145,
    compatibleWith: [],
  },
  {
    code: "VID-SPLFIB",
    name: "Kit de limpieza de conectores ópticos",
    description: "Kit de limpieza y comprobación de conectores LEMO y LC.",
    category: "Consumibles",
    unit: "ud",
    stock: 2,
    minStock: 2,
    location: "F-08",
    supplier: "Thorlabs",
    partNumber: "FC-KIT",
    unitPrice: 210,
    compatibleWith: ["EQ-013"],
  },
];

const ALL_PARTS: SeedPart[] = [...SEED_PARTS, ...EXTRA_PARTS];

/** Línea de petición apuntando al repuesto recién insertado. */
function line(
  ids: Record<string, Id<"spareParts">>,
  code: string,
  quantity: number,
) {
  const sparePartId = ids[code];
  const name = ALL_PARTS.find((p) => p.code === code)?.name;
  if (!sparePartId || !name) {
    throw new ConvexError(
      `Datos de ejemplo incompletos: falta el repuesto ${code}.`,
    );
  }
  return { sparePartId, code, name, quantity };
}

/* ------------------------------------------------------------------ */
/* Inventario de equipos                                               */
/* ------------------------------------------------------------------ */

interface SeedEquipment {
  code: string;
  brand: string;
  name: string;
  model: string;
  location: string;
  description?: string;
  serialNumber: string;
  supplier: string;
  /** Antigüedad del alta, en meses (mantiene la muestra realista). */
  purchaseMonthsAgo: number;
  warrantyMonths: number;
  maintenanceIntervalDays: number;
  /** true = el plan va con la última revisión vencida (para la demo). */
  late?: boolean;
  /** Meses desde la baja del equipo (si ya no está en servicio). */
  decommissionMonthsAgo?: number;
  /** Familia del equipo; solo se usa para generar incidencias verosímiles. */
  kind: EquipmentKind;
}

/** Equipos audiovisuales de ejemplo: cámaras, realización, rack e iluminación. */
const SEED_EQUIPMENT: SeedEquipment[] = [
  {
    code: "EQ-001",
    brand: "Sony",
    name: "Cámara de estudio",
    model: "HDC-3500",
    location: "Plató 1",
    serialNumber: "HDC3500-2505-0147",
    supplier: "Sony Professional",
    purchaseMonthsAgo: 17,
    warrantyMonths: 24, // garantía vigente
    maintenanceIntervalDays: 180,
    kind: "camara",
  },
  {
    code: "EQ-002",
    brand: "Riedel",
    name: "Intercom de realización",
    model: "Bolero",
    location: "Sala de realización",
    serialNumber: "BLR-2302-8821",
    supplier: "Riedel ES",
    purchaseMonthsAgo: 44,
    warrantyMonths: 24, // garantía caducada
    maintenanceIntervalDays: 365,
    late: true, // revisión anual vencida
    kind: "audio",
  },
  {
    code: "EQ-003",
    brand: "Ross",
    name: "Conmutador de realización",
    model: "Carbonite Ultra",
    location: "Sala de realización",
    serialNumber: "CU-2409-3310",
    supplier: "Ross Video Ibérica",
    purchaseMonthsAgo: 25,
    warrantyMonths: 60, // 5 años de garantía
    maintenanceIntervalDays: 180,
    kind: "video",
  },
  {
    code: "EQ-004",
    brand: "Evertz",
    name: "Router de vídeo",
    model: "7800FR 128×128",
    location: "Rack central",
    serialNumber: "7800FR-2203-0064",
    supplier: "Evertz Europe",
    purchaseMonthsAgo: 55,
    warrantyMonths: 24, // garantía caducada
    maintenanceIntervalDays: 90, // revisión trimestral → vencida en la demo
    late: true,
    kind: "video",
  },
  {
    code: "EQ-005",
    brand: "ARRI",
    name: "Panel LED de plató",
    model: "SkyPanel S60-C",
    location: "Plató 2",
    serialNumber: "S60C-2601-1192",
    supplier: "ARRI Cine y TV",
    purchaseMonthsAgo: 9,
    warrantyMonths: 12,
    maintenanceIntervalDays: 365,
    kind: "iluminacion",
  },
  {
    code: "EQ-006",
    brand: "Tektronix",
    name: "Monitor de forma de onda",
    model: "WFM5200",
    location: "Sala de control",
    serialNumber: "WFM5200-2106-5507",
    supplier: "Tektronix Ibérica",
    purchaseMonthsAgo: 64,
    warrantyMonths: 36, // garantía caducada
    maintenanceIntervalDays: 365,
    late: true,
    kind: "video",
  },
];

/** Resto del inventario: unidades móviles, plató 3, postproducción y rack. */
const EXTRA_EQUIPMENT: SeedEquipment[] = [
  {
    code: "EQ-007",
    brand: "Sony",
    name: "Cámara ENG",
    model: "PXW-Z750",
    location: "Unidad móvil 1",
    serialNumber: "PXWZ750-2403-1180",
    supplier: "Sony Professional",
    purchaseMonthsAgo: 22,
    warrantyMonths: 24,
    maintenanceIntervalDays: 180,
    kind: "camara",
  },
  {
    code: "EQ-008",
    brand: "Blackmagic",
    name: "Cámara de estudio",
    model: "URSA Broadcast G2",
    location: "Plató 3",
    serialNumber: "URSA-2311-4471",
    supplier: "Blackmagic Design",
    purchaseMonthsAgo: 30,
    warrantyMonths: 24,
    maintenanceIntervalDays: 180,
    kind: "camara",
  },
  {
    code: "EQ-009",
    brand: "Canon",
    name: "Objetivo de estudio",
    model: "CJ45ex9.7B",
    location: "Plató 1",
    serialNumber: "CJ45-2209-7788",
    supplier: "Canon España",
    purchaseMonthsAgo: 46,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    kind: "camara",
  },
  {
    code: "EQ-010",
    brand: "Sennheiser",
    name: "Sistema de microfonía inalámbrica",
    model: "EW-DX",
    location: "Plató 2",
    serialNumber: "EWDX-2501-9931",
    supplier: "Sennheiser Ibérica",
    purchaseMonthsAgo: 12,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    kind: "audio",
  },
  {
    code: "EQ-011",
    brand: "Yamaha",
    name: "Mesa de mezclas de audio",
    model: "DM7",
    location: "Sala de audio",
    serialNumber: "DM7-2405-2210",
    supplier: "Yamaha Pro Audio",
    purchaseMonthsAgo: 18,
    warrantyMonths: 36,
    maintenanceIntervalDays: 365,
    kind: "audio",
  },
  {
    code: "EQ-012",
    brand: "Shure",
    name: "Micrófono de solapa",
    model: "Axient Digital",
    location: "Plató 3",
    serialNumber: "AXT-2308-6640",
    supplier: "Shure Iberia",
    purchaseMonthsAgo: 34,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    late: true,
    kind: "audio",
  },
  {
    code: "EQ-013",
    brand: "Evertz",
    name: "Generador de sincronía",
    model: "SPG 5600",
    location: "Rack central",
    serialNumber: "SPG-2104-3390",
    supplier: "Evertz Europe",
    purchaseMonthsAgo: 62,
    warrantyMonths: 36,
    maintenanceIntervalDays: 365,
    late: true,
    kind: "video",
  },
  {
    code: "EQ-014",
    brand: "Lawo",
    name: "Matriz de audio",
    model: "Nova",
    location: "Sala de control",
    serialNumber: "NOVA-2202-0143",
    supplier: "Lawo AG",
    purchaseMonthsAgo: 52,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    kind: "audio",
  },
  {
    code: "EQ-015",
    brand: "Avid",
    name: "Puesto de edición",
    model: "Media Composer",
    location: "Postproducción 1",
    serialNumber: "MC-2506-8812",
    supplier: "Avid Technology",
    purchaseMonthsAgo: 10,
    warrantyMonths: 12,
    maintenanceIntervalDays: 365,
    kind: "informatica",
  },
  {
    code: "EQ-016",
    brand: "Netgear",
    name: "Conmutador de red 10 GbE",
    model: "M4300",
    location: "Rack central",
    serialNumber: "M4300-2410-5521",
    supplier: "Netgear",
    purchaseMonthsAgo: 20,
    warrantyMonths: 60,
    maintenanceIntervalDays: 365,
    kind: "red",
  },
  {
    code: "EQ-017",
    brand: "APC",
    name: "SAI de rack",
    model: "Smart-UPS 3000",
    location: "Rack central",
    serialNumber: "SU3000-2005-7712",
    supplier: "APC by Schneider",
    purchaseMonthsAgo: 68,
    warrantyMonths: 36,
    maintenanceIntervalDays: 180,
    late: true,
    kind: "energia",
  },
  {
    code: "EQ-018",
    brand: "Telestream",
    name: "Grabador de señales",
    model: "Lightspeed Live",
    location: "Sala de control",
    serialNumber: "LS-2207-9914",
    supplier: "Telestream",
    purchaseMonthsAgo: 45,
    warrantyMonths: 24,
    maintenanceIntervalDays: 180,
    kind: "video",
  },
  {
    code: "EQ-019",
    brand: "Panasonic",
    name: "Cámara PTZ",
    model: "AW-UE150",
    location: "Plató 2",
    serialNumber: "UE150-2602-3345",
    supplier: "Panasonic Pro AV",
    purchaseMonthsAgo: 8,
    warrantyMonths: 36,
    maintenanceIntervalDays: 365,
    kind: "camara",
  },
  {
    code: "EQ-020",
    brand: "Barco",
    name: "Monitor de realización",
    model: 'MDSC-8424 24"',
    location: "Sala de realización",
    serialNumber: "MDSC-2312-1188",
    supplier: "Barco",
    purchaseMonthsAgo: 28,
    warrantyMonths: 36,
    maintenanceIntervalDays: 365,
    kind: "video",
  },
  {
    code: "EQ-021",
    brand: "Grass Valley",
    name: "Servidor de vídeo",
    model: "K2 Summit",
    location: "Sala de control",
    serialNumber: "K2-1909-4402",
    supplier: "Grass Valley",
    purchaseMonthsAgo: 74,
    warrantyMonths: 24,
    maintenanceIntervalDays: 180,
    late: true,
    kind: "video",
  },
  {
    code: "EQ-022",
    brand: "DPA",
    name: "Micrófono de caña",
    model: "4017",
    location: "Plató 1",
    serialNumber: "DPA-2503-2299",
    supplier: "DPA Microphones",
    purchaseMonthsAgo: 14,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    kind: "audio",
  },
  {
    code: "EQ-023",
    brand: "Litepanels",
    name: "Foco LED de plató",
    model: "Gemini 2x1",
    location: "Plató 3",
    serialNumber: "GEM-2404-6677",
    supplier: "Litepanels",
    purchaseMonthsAgo: 16,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    kind: "iluminacion",
  },
  {
    code: "EQ-024",
    brand: "Manfrotto",
    name: "Trípode de cámara",
    model: "546B",
    location: "Unidad móvil 2",
    serialNumber: "546B-1801-3320",
    supplier: "Manfrotto",
    purchaseMonthsAgo: 80,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    late: true,
    kind: "mecanica",
  },
  {
    code: "EQ-025",
    brand: "JVC",
    name: "Monitor de confianza",
    model: 'TM-1400 14"',
    location: "Almacén",
    description: "Retirado del servicio; se conserva como repuesto de plató.",
    serialNumber: "TM1400-1205-0091",
    supplier: "JVC Professional",
    purchaseMonthsAgo: 150,
    warrantyMonths: 24,
    maintenanceIntervalDays: 365,
    decommissionMonthsAgo: 30,
    kind: "video",
  },
];

const ALL_EQUIPMENT: SeedEquipment[] = [...SEED_EQUIPMENT, ...EXTRA_EQUIPMENT];

/* ------------------------------------------------------------------ */
/* Textos de la muestra                                                */
/* ------------------------------------------------------------------ */

/** Quién notifica: plató, realización, audio, exteriores y postproducción. */
const REPORTERS: { name: string; role: string }[] = [
  { name: "Laura Peña", role: "Realización" },
  { name: "Marcos Vega", role: "Sala de realización" },
  { name: "Sandra Ruiz", role: "Cámara" },
  { name: "Nuria Cano", role: "Servicios técnicos" },
  { name: "Iván Torres", role: "Iluminación" },
  { name: "Jorge Luna", role: "Servicios técnicos" },
  { name: "Alba Moreno", role: "Producción" },
  { name: "Diego Herrera", role: "Sonido" },
  { name: "Paula Iglesias", role: "Regiduría" },
  { name: "Raúl Nieto", role: "Postproducción" },
  { name: "Carmen Ortiz", role: "Plató 2" },
  { name: "Sergio Bravo", role: "Mantenimiento" },
  { name: "Marta Soler", role: "Documentales" },
  { name: "Adrián Castro", role: "Deportes" },
  { name: "Lucía Ferrer", role: "Informativos" },
  { name: "Hugo Salas", role: "Exteriores" },
  { name: "Rocío Gil", role: "Maquillaje y vestuario" },
  { name: "Elena Vidal", role: "Coordinación" },
];

/** Técnicos de ejemplo; se usan si el taller aún no tiene usuarios propios. */
const MOCK_TECHS = [
  "Iván Torres",
  "Nuria Cano",
  "Sergio Bravo",
  "Diego Herrera",
  "Raúl Nieto",
  "Paula Iglesias",
];

/** Averías verosímiles según la familia del equipo averiado. */
const FAILURES: Record<EquipmentKind, string[]> = {
  camara: [
    "La imagen pierde sincronía y aparece un parpadeo en el multiviewer durante el directo.",
    "El obturador se queda bloqueado tras un cambio de formato y no responde al mando.",
    "El visor muestra interferencias y el enfoque se va al mover el cable de cámara.",
  ],
  audio: [
    "Se oye un zumbido constante en el canal 2 que sube al abrir el fader.",
    "El receptor se desincroniza y hay microcortes al alejarse más de diez metros.",
    "Un canal no da retorno; en realización no llega la señal de intercom.",
  ],
  video: [
    "Una salida se queda en negro; al reiniciar vuelve y vuelve a caer en unos minutos.",
    "Aparecen artefactos de bloque en la señal de una de las entradas del conmutador.",
    "La señal no conmuta cuando toca y se pierde el primer fotograma del plano.",
  ],
  red: [
    "El puerto enlaza a 1 Gb en vez de 10 Gb y provoca caídas en la red de control.",
    "Se pierden paquetes cuando coinciden varias transferencias grandes al servidor.",
  ],
  energia: [
    "El SAI pasa a batería sin motivo y la carga dura muy pocos minutos.",
    "El equipo se apaga solo en caliente; moviendo el cable de red vuelve a arrancar.",
    "Huele a sobrecalentamiento en la fuente y el ventilador hace más ruido de lo normal.",
  ],
  iluminacion: [
    "Un grupo de LED no enciende; el resto del panel responde bien.",
    "El foco no mantiene la intensidad y se queda al 50 % a los pocos minutos.",
    "La temperatura de color salta sola entre 3200 K y 5600 K sin tocar la mesa.",
  ],
  informatica: [
    "El programa se cierra solo al exportar y no guarda el proyecto.",
    "Arranca muy lento y avisa de que el disco de trabajo está casi lleno.",
  ],
  mecanica: [
    "El movimiento de pan se atasca en el tramo final del recorrido.",
    "El freno no fija la cámara y la cabeza se desliza al inclinar.",
  ],
};

/** Incidencias sin equipo del inventario: material suelto de plató. */
const STRAY_EQUIPMENT: { label: string; model: string; kind: EquipmentKind }[] =
  [
    { label: "Monitor de plató", model: "Sony LMD-2440", kind: "video" },
    { label: "Degradador de luz", model: "Showtec 4000", kind: "iluminacion" },
    { label: "Radioenlace móvil", model: "Vislink MICRO HD", kind: "video" },
    { label: "Trípode de cámara", model: "Manfrotto 546B", kind: "mecanica" },
    { label: "Grupo electrógeno", model: "Honda EU70is", kind: "energia" },
  ];

const ASSIGN_NOTES = [
  "Asignada por coordinación.",
  "Autoasignada por el técnico.",
  "Tomada al terminar el turno anterior.",
];

const WORKSHOP_NOTES = [
  "Derivada a taller para revisión en el banco.",
  "Entra a taller: hay que desmontar la carcasa.",
  "A taller: el fallo no se reproduce en el plató.",
];

const RESOLUTIONS = [
  "Se sustituyó la pieza y el equipo quedó en pruebas una hora sin fallos.",
  "Reparado en el banco: soldadura rehecha y conexión asegurada con termorretráctil.",
  "Se cambió la fuente por una de repuesto y se comprobó la alimentación en carga.",
  "Limpieza de contactos y ventilación; vuelve a funcionar dentro de especificación.",
  "Se actualizó el firmware y se recalibró; sin avisos tras el reinicio.",
  "Conector de campo sustituido y señal verificada con el monitor de forma de onda.",
  "Se reasentó el módulo en el rack y se comprobó sujeción y temperatura.",
  "Se ajustó el mecanismo y se probó el recorrido completo en los dos sentidos.",
];

const UNRESOLVED_NOTES = [
  "No se pudo reproducir el fallo; el equipo queda en seguimiento.",
  "Esperando repuesto del proveedor: se cierra sin resolución por ahora.",
  "El fallo está en el bloque principal y el coste supera el valor del equipo.",
  "Avería intermitente: se prueba en el próximo directo para localizarla.",
];

/** Documentos que se van anexando a una incidencia durante su ciclo de vida. */
const INCIDENT_DOCUMENTS = [
  "Reporte técnico.pdf",
  "Fotos del daño.jpg",
  "Presupuesto de reparación.pdf",
  "Albarán de repuestos.pdf",
  "Manual de servicio.pdf",
  "Parte de intervención.pdf",
  "Acta de baja.pdf",
];

/** Comentario opcional que acompaña a un documento anexado. */
const DOCUMENT_NOTES = [
  "Adjuntado por el técnico al verificar la incidencia.",
  "Copia para el expediente del equipo.",
  "Documento aportado por el proveedor.",
  "Incluye las fotos del estado antes de la reparación.",
];

/** Notas fechadas que se generan a lo largo del ciclo de vida. */
const LIFECYCLE_NOTES = [
  "Diagnóstico en curso: se comprueba el cableado de señal.",
  "Pieza pedida al proveedor, pendiente de recepción.",
  "Se sustituye el módulo de alimentación y se prueba en banco.",
  "Queda a la espera de presupuesto para la reparación completa.",
  "Revisado con el equipo: se acuerda priorizar esta incidencia.",
  "Verificado tras la reparación: vuelve a funcionar con normalidad.",
];

const PREVENTIVE_TITLES = [
  "Revisión preventiva semestral",
  "Revisión preventiva anual",
  "Limpieza y comprobación preventiva",
  "Revisión trimestral del equipo",
];

const PREVENTIVE_NOTES = [
  "Limpieza de óptica y ventilación; comprobación de alimentación y temperaturas.",
  "Test de señales, apriete de conectores y revisión del cableado del rack.",
  "Calibración de niveles y comprobación de baterías y respaldos.",
  "Revisión del plan de mantenimiento: sin incidencias destacables.",
];

/** Peticiones de repuestos: quién pide y para qué equipo. */
const REQUESTERS: { name: string; team: string }[] = [
  { name: "Sandra Ruiz", team: "Cámara" },
  { name: "Marcos Vega", team: "Realización" },
  { name: "Nuria Cano", team: "Servicios técnicos" },
  { name: "Iván Torres", team: "Iluminación" },
  { name: "Jorge Luna", team: "Servicios técnicos" },
  { name: "Diego Herrera", team: "Sonido" },
  { name: "Marta Soler", team: "Documentales" },
  { name: "Hugo Salas", team: "Exteriores" },
  { name: "Adrián Castro", team: "Deportes" },
  { name: "Lucía Ferrer", team: "Informativos" },
  { name: "Carmen Ortiz", team: "Plató 2" },
  { name: "Raúl Nieto", team: "Postproducción" },
];

const REQUESTER_NOTES = [
  "Urge para el directo del sábado.",
  "El material se devuelve al terminar la grabación.",
  "No queda nada en el almacén, lo hemos comprobado.",
  "Es reposición de lo que se rompió en el rodaje de exteriores.",
  "Lo necesitamos para el mantenimiento preventivo del mes.",
  "Pedido para dejar el puesto completo antes de la próxima campaña.",
  "Lo pide el equipo de exteriores, no es para plató.",
];

/** Peticiones sin referencia: hay que buscar proveedor y precio. */
const FREE_REQUESTS = [
  "Necesitamos 2 monitores de realización de 10 pulgadas con soporte VESA. Buen ángulo de visión y entrada SDI. Presupuesto orientativo 450 € por unidad y entrega en menos de una semana.",
  "Un cable HDMI óptico de 20 m certificado para 4K a 60 Hz, para el puesto de grafismo del plató 2.",
  "Sustituir la bandeja deslizante de 2U del rack central: el carril derecho está doblado.",
  "Dos sillas de realización con reposabrazos ajustables y ruedas blandas.",
  "Un maletín de transporte para el objetivo de estudio, con espuma troquelada a medida.",
  "Tres regletas de rack de 8 tomas con protección y amperímetro.",
  "Kit de limpieza de conectores ópticos LEMO para la unidad móvil 1.",
  "Un pedestal de cámara con columna y base de estudio para el plató 3.",
];

const APPROVE_NOTES = [
  "Material apartado en el mostrador 1.",
  "Autorizado: hay stock suficiente para la entrega del lunes.",
  "Aprobado con cargo al presupuesto de mantenimiento del trimestre.",
  "Se entrega del almacén y se repone en el próximo pedido.",
];

/** Motivos de entrega: cómo salió el material del taller. */
const DELIVERY_NOTES = [
  "Entregado en mano al técnico en el mostrador.",
  "Lo recoge el equipo de plató para el directo de la tarde.",
  "Va con la caja y el albarán firmado.",
  "Entregado y probado en el taller antes de salir.",
];

const REJECT_NOTES = [
  "Sin presupuesto este trimestre: se revisa en enero.",
  "Ya se sustituyó el equipo, no hace falta el repuesto.",
  "Duplicada: se aprueba la petición anterior con el mismo material.",
  "Se descarta por incompatibilidad con el modelo instalado.",
];

/** Trabajo reciente: se queda en la cola del día a día. */
const RECENT_DAYS = [0.2, 1, 3, 6, 12, 20, 30];
/** Histórico: lo que ya está terminado y en su mayoría archivado. */
const OLD_DAYS = [60, 90, 140, 200, 300, 420, 560, 700, 900];
const AGE_CYCLE = RECENT_DAYS.length + OLD_DAYS.length;

/**
 * Antigüedad de cada registro de la muestra: en cada vuelta entra trabajo
 * reciente (entre horas y un mes) y trabajo antiguo (de dos meses a más de dos
 * años). Con varias vueltas la muestra cubre la cola del día y el archivo.
 */
function ageInDays(index: number): number {
  const cycle = Math.floor(index / AGE_CYCLE);
  const within = index % AGE_CYCLE;
  if (within < RECENT_DAYS.length) {
    return (RECENT_DAYS[within] ?? 5) + cycle * 4;
  }
  return (OLD_DAYS[within - RECENT_DAYS.length] ?? 200) + cycle * 240;
}

/** Corte entre «trabajo de la cola» y «histórico» (días). */
const RECENT_LIMIT_DAYS = 50;

/* ------------------------------------------------------------------ */
/* Muestra curada: la historia del taller                              */
/* ------------------------------------------------------------------ */

/** Peticiones de ejemplo ya resueltas o pendientes, en distintos estados. */
function seedRequests(ids: Record<string, Id<"spareParts">>, now: number) {
  return [
    {
      reference: "PET-0001",
      requesterName: "Sandra Ruiz",
      requesterTeam: "Cámara",
      equipment: "Cámara de estudio HDC-3500",
      equipmentCode: "EQ-001",
      priority: "urgent" as const,
      status: "pending" as const,
      lines: [line(ids, "ALI-24015", 1), line(ids, "BAT-19001", 1)],
      notes:
        "La cámara del plató 1 se apaga en directo: la fuente arranca y corta.",
      createdAt: now - 2 * H,
    },
    {
      reference: "PET-0002",
      requesterName: "Marcos Vega",
      requesterTeam: "Realización",
      equipment: "Intercom de realización Bolero",
      equipmentCode: "EQ-002",
      priority: "normal" as const,
      status: "pending" as const,
      lines: [line(ids, "AUD-AUR01", 2), line(ids, "AUD-XLR10", 2)],
      notes:
        "Dos posiciones de realización sin retorno y ruido en el intercom.",
      createdAt: now - 26 * H,
    },
    {
      reference: "PET-0003",
      requesterName: "Nuria Cano",
      requesterTeam: "Servicios técnicos",
      equipment: "Router de vídeo 7800FR 128×128",
      equipmentCode: "EQ-004",
      priority: "low" as const,
      status: "pending" as const,
      lines: [line(ids, "VID-BNC01", 10), line(ids, "VEN-08012", 1)],
      notes:
        "Reposición del panel de patch del rack central y ventilador ruidoso.",
      createdAt: now - 3 * 24 * H,
    },
    {
      reference: "PET-0006",
      requesterName: "Jorge Luna",
      requesterTeam: "Servicios técnicos",
      equipment: "Conmutador de realización Carbonite Ultra",
      equipmentCode: "EQ-003",
      priority: "normal" as const,
      status: "pending" as const,
      lines: [] as {
        sparePartId: Id<"spareParts">;
        code: string;
        name: string;
        quantity: number;
      }[],
      description: FREE_REQUESTS[0],
      notes: "Sin referencia concreta: hay que buscar proveedor y part number.",
      createdAt: now - 8 * H,
    },
    {
      reference: "PET-0004",
      requesterName: "Iván Torres",
      requesterTeam: "Iluminación",
      equipment: "Panel LED de plató SkyPanel S60-C",
      equipmentCode: "EQ-005",
      priority: "normal" as const,
      status: "approved" as const,
      lines: [line(ids, "ILU-LED60", 1)],
      notes: "Un panel del plató 2 parpadea a 3200 K; se sustituye entero.",
      decisionNote: "Material apartado en el mostrador 1.",
      decidedBy: "Responsable de repuestos",
      decidedAt: now - 20 * H,
      createdAt: now - 30 * H,
    },
    {
      reference: "PET-0005",
      requesterName: "Sandra Ruiz",
      requesterTeam: "Cámara",
      equipment: "Monitor de forma de onda WFM5200",
      equipmentCode: "EQ-006",
      priority: "low" as const,
      status: "issued" as const,
      lines: [line(ids, "VID-BNC01", 4), line(ids, "VEN-08012", 1)],
      decisionNote:
        "Autorizado: hay stock suficiente para la entrega del lunes.",
      decidedBy: "Responsable de repuestos",
      decidedAt: now - 6 * 24 * H,
      issuedAt: now - 5 * 24 * H,
      issueNote: "Entregado en mano.",
      createdAt: now - 7 * 24 * H,
    },
  ];
}

/** Historial de mantenimiento de ejemplo: averías y revisiones preventivas. */
interface SeedMaintenance {
  equipmentCode: string;
  kind: "repair" | "preventive";
  title: string;
  description?: string;
  daysAgo: number;
  technician?: string;
  requestReference?: string;
}

const SEED_MAINTENANCE: SeedMaintenance[] = [
  {
    equipmentCode: "EQ-001",
    kind: "preventive",
    title: "Revisión semestral de cámara",
    description:
      "Limpieza de óptica, comprobación de alimentación y ventilación.",
    daysAgo: 40,
    technician: "Iván Torres",
  },
  {
    equipmentCode: "EQ-001",
    kind: "repair",
    title: "Sustitución de la fuente de alimentación",
    description: "Cortaba en caliente: sustituida por una NDR-150-24.",
    daysAgo: 120,
    technician: "Iván Torres",
  },
  {
    equipmentCode: "EQ-004",
    kind: "preventive",
    title: "Limpieza y test de señales del router",
    description: "Revisión de ventiladores y test de las 128 entradas SDI.",
    daysAgo: 100, // con un plan de 90 días, la revisión está vencida
    technician: "Nuria Cano",
  },
  {
    equipmentCode: "EQ-005",
    kind: "repair",
    title: "Panel con parpadeo a 3200 K",
    description:
      "Sustituido el driver del canal LED; material de la petición PET-0004.",
    daysAgo: 25,
    technician: "Iván Torres",
    requestReference: "PET-0004",
  },
  {
    equipmentCode: "EQ-002",
    kind: "preventive",
    title: "Revisión anual del intercom",
    description: "Firmware de los paneles y test de baterías de los packs.",
    daysAgo: 200,
    technician: "Marcos Vega",
  },
];

/** Incidencias de ejemplo: pendientes, en taller y autoasignadas. */
interface SeedIncident {
  reference: string;
  /** El código con el que la seguiría quien notificó (aquí, escrito a mano). */
  publicCode: string;
  reporterName: string;
  reporterRole: string;
  location: string;
  equipmentCode: string;
  equipmentKind: string;
  model: string;
  serialNumber: string;
  description: string;
  hoursAgo: number;
  status: "reported" | "assigned" | "workshop";
  assigneeName?: string;
  workshopAssigneeName?: string;
}

const SEED_INCIDENTS: SeedIncident[] = [
  {
    reference: "INC-0001",
    publicCode: "M4KQ7X2P",
    reporterName: "Laura Peña",
    reporterRole: "Realización",
    location: "Sala de realización",
    equipmentCode: "EQ-002",
    equipmentKind: "Intercom de realización",
    model: "Bolero",
    serialNumber: "BLR-2302-8821",
    description:
      "El panel del puesto 3 no enciende desde esta mañana; el resto de la sala funciona con normalidad.",
    hoursAgo: 5,
    status: "reported",
  },
  {
    reference: "INC-0002",
    publicCode: "R9TW5H8N",
    reporterName: "Marcos Vega",
    reporterRole: "Sala de realización",
    location: "Rack central",
    equipmentCode: "EQ-004",
    equipmentKind: "Router de vídeo",
    model: "7800FR 128×128",
    serialNumber: "7800FR-2203-0064",
    description:
      "Dos entradas del rack C no sincronizan; se pierde señal en el plató 2 intermitentemente.",
    hoursAgo: 26,
    status: "assigned",
    assigneeName: "Nuria Cano",
  },
  {
    reference: "INC-0003",
    publicCode: "B6YP3JQZ",
    reporterName: "Sandra Ruiz",
    reporterRole: "Cámara",
    location: "Plató 1",
    equipmentCode: "EQ-001",
    equipmentKind: "Cámara de estudio",
    model: "HDC-3500",
    serialNumber: "HDC3500-2505-0147",
    description:
      "La cámara pierde alimentación en directo cuando se mueve el cable de la batería; se ve un parpadeo en realización.",
    hoursAgo: 30,
    status: "workshop",
    assigneeName: "Iván Torres",
    workshopAssigneeName: "Iván Torres",
  },
];

/* ------------------------------------------------------------------ */
/* Generación de la muestra larga                                      */
/* ------------------------------------------------------------------ */

/** Equipo del inventario tal y como lo usan los generadores. */
interface EquipmentRef {
  id: Id<"equipment">;
  code: string;
  name: string;
  model: string;
  location: string;
  serialNumber: string;
  kind: EquipmentKind;
}

/** Repuesto tal y como lo usan los generadores. */
interface PartRef {
  id: Id<"spareParts">;
  code: string;
  name: string;
}

/**
 * Documento del expediente tal como lo genera la muestra, con el rastro de
 * auditoría que dejó: el alta siempre está; el renombrado y la retirada son
 * opcionales. Un documento con `removedAt` ya no está en la ficha: su traza es
 * lo único que queda.
 */
interface GeneratedDocument {
  name: string;
  note?: string;
  author: string;
  createdAt: number;
  /** Nombre con el que entró en el expediente, si después se renombró. */
  previousName?: string;
  renamedAt?: number;
  removedAt?: number;
  /** Quien coordina y firma sus movimientos en el rastro. */
  byId: Id<"users">;
}

interface GeneratedIncident {
  reference: string;
  publicCode: string;
  reporterName: string;
  reporterRole?: string;
  location?: string;
  equipmentKind: string;
  model: string;
  serialNumber?: string;
  description: string;
  reportedAt: number;
  status: IncidentStatus;
  equipmentId?: Id<"equipment">;
  assigneeName?: string;
  workshopAssigneeName?: string;
  notes?: string;
  closedAt?: number;
  archivedAt?: number;
  archivedBy?: string;
  // Documentos y notas que se van dejando durante el ciclo de vida. Los
  // documentos se crean aparte (no llevan `_id` hasta insertarlos).
  documents?: GeneratedDocument[];
  // Una nota corregida guarda lo que decía antes (`versions`): la muestra
  // enseña también el historial de cambios en la ficha.
  lifecycleNotes?: {
    note: string;
    author: string;
    at: number;
    editedAt?: number;
    versions?: { note: string; at: number }[];
  }[];
  history: Doc<"incidents">["history"];
  createdAt: number;
  updatedAt: number;
}

/**
 * Un código de seguimiento de la muestra, del azar reproducible de la carga.
 *
 * Va con su propio generador —no con el del resto de la ficha— para que añadir
 * códigos no mueva ni un dato de la muestra que ya había. No pretende ser secreto
 * —está a la vista en el código y cualquiera puede recalcularlo— sino que la
 * muestra tenga la misma forma que los datos de verdad: un caso de ejemplo,
 * abierto en la consulta de fuera, sin tocar los que se hayan notificado de
 * verdad.
 */
function samplePublicCode(rnd: () => number): string {
  const bytes = new Uint8Array(PUBLIC_CODE_LENGTH);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(rnd() * 256);
  }
  return publicCodeFrom(bytes);
}

/**
 * Reparte la muestra en el tiempo: los estados abiertos solo aparecen en lo
 * reciente y todo lo terminado hace más de un año nace ya archivado (como si la
 * pasada nocturna hubiera corrido). Se deja a propósito uno de cada nueve sin
 * archivar para poder probar el archivado a mano.
 */
function buildIncidents(opts: {
  startSequence: number;
  count: number;
  now: number;
  seed: number;
  equipment: EquipmentRef[];
  technicians: string[];
  /** Quiénes firman los movimientos de documentos: el primero carga la muestra. */
  signers: { id: Id<"users">; name: string }[];
}): GeneratedIncident[] {
  const { startSequence, count, now, equipment, technicians, signers } = opts;
  const rnd = random(opts.seed);
  // Los cambios de los documentos se sortean con su propio generador: así el
  // rastro de auditoría aparece sin tocar ni un dato de la muestra anterior
  // (mismos nombres, mismas notas, mismas fechas).
  const trailRnd = random(opts.seed + 101);
  // Y quién firma cada documento, con un tercer generador: dos instalaciones
  // con los mismos coordinadores comparten rastro, y la muestra no se mueve
  // por repartir las firmas entre varias personas.
  const signerRnd = random(opts.seed + 202);
  // Qué notas de la muestra se corrigieron, con un generador propio: añadir
  // correcciones no desplaza ni un sorteo de las notas que ya había.
  const versionRnd = random(opts.seed + 303);
  // Los códigos de seguimiento, con otro generador propio por la misma razón: la
  // muestra enseña casos que se pueden seguir desde fuera, y repartirlos no puede
  // cambiar ni una fecha de lo que ya había. Los de verdad llevan el azar del
  // servidor (`convex/publicCodes`); estos son reproducibles para poder probarlos.
  const codeRnd = random(opts.seed + 404);
  const cutoff = monthsAgo(DEFAULT_AFTER_MONTHS, now);
  const items: GeneratedIncident[] = [];

  for (let i = 0; i < count; i += 1) {
    const sequence = startSequence + i;
    const days = ageInDays(i);
    const reportedAt = now - Math.round(days * DAY) - Math.round(rnd() * 6 * H);
    const freeText = i % 7 === 3 || equipment.length === 0;
    const target = equipment.length
      ? equipment[(i * 7) % equipment.length]
      : undefined;
    const stray = pick(rnd, STRAY_EQUIPMENT);
    const reporter = pick(rnd, REPORTERS);

    const open: IncidentStatus[] = ["reported", "assigned", "workshop"];
    const closed: IncidentStatus = rnd() < 0.78 ? "resolved" : "unresolved";
    // Lo reciente está casi todo en marcha (con algún cierre del mismo día);
    // lo antiguo ya está terminado.
    const status: IncidentStatus =
      days <= RECENT_LIMIT_DAYS
        ? rnd() < 0.22
          ? closed
          : pick(rnd, open)
        : closed;

    const assigneeName = pick(rnd, technicians);
    const kind: EquipmentKind = freeText
      ? stray.kind
      : (target?.kind ?? "video");
    const equipmentKind = freeText
      ? stray.label
      : (target?.name ?? stray.label);
    const model = freeText ? stray.model : (target?.model ?? stray.model);
    const description = pick(rnd, FAILURES[kind]);

    const history: Doc<"incidents">["history"] = [
      { status: "reported", at: reportedAt, by: reporter.name },
    ];
    let updatedAt = reportedAt;

    if (status !== "reported") {
      const at = reportedAt + Math.round((1 + rnd() * 4) * H);
      history.push({
        status: "assigned",
        at,
        by: assigneeName,
        note: pick(rnd, ASSIGN_NOTES),
      });
      updatedAt = at;
    }

    let workshopAssigneeName: string | undefined;
    if (status === "workshop") {
      const at = reportedAt + Math.round((6 + rnd() * 18) * H);
      workshopAssigneeName = pick(rnd, technicians);
      history.push({
        status: "workshop",
        at,
        by: workshopAssigneeName,
        note: pick(rnd, WORKSHOP_NOTES),
      });
      updatedAt = at;
    }

    let closedAt: number | undefined;
    let notes: string | undefined;
    if (status === "resolved" || status === "unresolved") {
      const at = Math.min(
        now - H,
        reportedAt + Math.round((8 + rnd() * 96) * H),
      );
      closedAt = at;
      notes =
        status === "resolved"
          ? pick(rnd, RESOLUTIONS)
          : pick(rnd, UNRESOLVED_NOTES);
      history.push({
        status,
        at,
        by: status === "resolved" ? pick(rnd, technicians) : assigneeName,
        note: notes,
      });
      updatedAt = at;
    }

    // Un año fuera del día a día; uno de cada nueve se queda sin archivar para
    // poder probar el archivado manual y el automático.
    let archivedAt: number | undefined;
    if (closedAt !== undefined && closedAt < cutoff && i % 9 !== 0) {
      archivedAt = Math.min(
        now - H,
        closedAt + DAY + Math.round(rnd() * 6 * H),
      );
      history.push({
        status,
        at: archivedAt,
        by: AUTO_ARCHIVE_BY,
        note: "Archivada",
      });
      updatedAt = archivedAt;
    }

    // Documentos y notas que se generan durante el ciclo de vida: no todos
    // los avisos tienen, pero los que pasan por taller suelen acumular alguno.
    const documents: GeneratedDocument[] = [];
    if (status !== "reported" && rnd() < 0.45) {
      const amount = 1 + Math.floor(rnd() * 2);
      for (let d = 0; d < amount; d += 1) {
        const at = Math.min(
          closedAt ?? now - H,
          reportedAt + Math.round((4 + rnd() * 60) * H),
        );
        const name = pick(rnd, INCIDENT_DOCUMENTS);
        // Quien carga los datos de ejemplo coordina el taller, pero el
        // expediente lo mueven todos los que pueden gestionar una incidencia:
        // el rastro reparte las firmas entre los coordinadores disponibles.
        const signer = pick(signerRnd, signers);
        // El expediente no es solo altas: a veces alguien renombra un adjunto o
        // lo retira, y eso es lo que queda anotado en el rastro de auditoría.
        const renamedTo = name.replace(/(\.[a-z0-9]+)$/i, " (revisado)$1");
        const renamed = renamedTo !== name && trailRnd() < 0.3;
        const removed = !renamed && trailRnd() < 0.15;
        // Los cambios posteriores caen dentro de la vida del expediente.
        const after = () =>
          Math.min(
            closedAt ?? now - H,
            at + Math.round((1 + trailRnd() * 24) * H),
          );
        documents.push({
          name: renamed ? renamedTo : name,
          ...(renamed ? { previousName: name, renamedAt: after() } : {}),
          ...(removed ? { removedAt: after() } : {}),
          ...(rnd() < 0.6 ? { note: pick(rnd, DOCUMENT_NOTES) } : {}),
          author: signer.name,
          byId: signer.id,
          createdAt: at,
        });
      }
    }

    const lifecycleNotes: NonNullable<GeneratedIncident["lifecycleNotes"]> = [];
    if (status !== "reported" && rnd() < 0.55) {
      const amount = 1 + Math.floor(rnd() * 2);
      for (let n = 0; n < amount; n += 1) {
        const at = Math.min(
          closedAt ?? now - H,
          reportedAt + Math.round((2 + rnd() * 50) * H),
        );
        const note = pick(rnd, LIFECYCLE_NOTES);
        const author = pick(rnd, technicians);
        // Alguna nota se corrigió al cabo de unas horas: así el historial de
        // cambios aparece en la ficha sin escribir y corregir una a mano.
        const editedAt = at + Math.round((1 + versionRnd() * 18) * H);
        const corrected =
          versionRnd() < 0.25 && editedAt <= (closedAt ?? now - H);
        lifecycleNotes.push(
          corrected
            ? {
                note: `${note} Confirmado tras repetir la prueba.`,
                author,
                at,
                editedAt,
                versions: [{ note, at: editedAt }],
              }
            : { note, author, at },
        );
      }
    }

    items.push({
      reference: formatReference("incident", sequence),
      publicCode: samplePublicCode(codeRnd),
      reporterName: reporter.name,
      reporterRole: reporter.role ?? undefined,
      ...(freeText ? {} : { location: target?.location }),
      equipmentKind,
      model,
      ...(freeText ? {} : { serialNumber: target?.serialNumber }),
      description,
      reportedAt,
      status,
      ...(freeText || !target ? {} : { equipmentId: target.id }),
      ...(status === "reported" ? {} : { assigneeName }),
      ...(workshopAssigneeName ? { workshopAssigneeName } : {}),
      ...(notes ? { notes } : {}),
      ...(closedAt !== undefined ? { closedAt } : {}),
      ...(archivedAt !== undefined
        ? { archivedAt, archivedBy: AUTO_ARCHIVE_BY }
        : {}),
      ...(documents.length > 0 ? { documents } : {}),
      ...(lifecycleNotes.length > 0 ? { lifecycleNotes } : {}),
      history,
      createdAt: reportedAt,
      updatedAt,
    });
  }

  return items;
}

interface GeneratedRequest {
  reference: string;
  requesterName: string;
  requesterTeam: string;
  equipment?: string;
  equipmentId?: Id<"equipment">;
  priority: Priority;
  status: RequestStatus;
  lines: {
    sparePartId: Id<"spareParts">;
    code: string;
    name: string;
    quantity: number;
  }[];
  description?: string;
  notes?: string;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: number;
  issuedAt?: number;
  issueNote?: string;
  archivedAt?: number;
  archivedBy?: string;
  createdAt: number;
}

function buildRequests(opts: {
  startSequence: number;
  count: number;
  now: number;
  seed: number;
  equipment: EquipmentRef[];
  parts: PartRef[];
}): GeneratedRequest[] {
  const { startSequence, count, now, equipment, parts } = opts;
  const rnd = random(opts.seed);
  const cutoff = monthsAgo(DEFAULT_AFTER_MONTHS, now);
  const items: GeneratedRequest[] = [];

  for (let i = 0; i < count; i += 1) {
    const sequence = startSequence + i;
    // Desfase respecto a las incidencias para que las dos colas no vayan en
    // paralelo (una petición de hoy y una incidencia de hace tres años).
    const days = ageInDays(i + 5);
    const createdAt = now - Math.round(days * DAY) - Math.round(rnd() * 10 * H);
    const requester = pick(rnd, REQUESTERS);
    const target = equipment.length
      ? equipment[(i * 5) % equipment.length]
      : undefined;
    const noCatalog = i % 6 === 4 || parts.length === 0;
    const lines = noCatalog
      ? []
      : Array.from({ length: 1 + (i % 3) }, (_, k) => {
          const part = parts[(i * 3 + k * 7) % parts.length];
          return {
            sparePartId: part.id,
            code: part.code,
            name: part.name,
            quantity: 1 + ((i + k) % 4),
          };
        });

    // Lo reciente sigue sin decidir; lo antiguo ya tiene decisión.
    const status: RequestStatus =
      days <= RECENT_LIMIT_DAYS
        ? rnd() < 0.65
          ? "pending"
          : "approved"
        : rnd() < 0.45
          ? "issued"
          : rnd() < 0.45
            ? "approved"
            : "rejected";

    const decidedAt =
      status === "pending"
        ? undefined
        : Math.min(now - H, createdAt + Math.round((2 + rnd() * 70) * H));
    const issuedAt =
      status === "issued" && decidedAt !== undefined
        ? Math.min(now - H, decidedAt + Math.round((1 + rnd() * 6) * DAY))
        : undefined;

    const decision =
      status === "approved" || status === "issued"
        ? pick(rnd, APPROVE_NOTES)
        : status === "rejected"
          ? pick(rnd, REJECT_NOTES)
          : undefined;

    // Igual que en las incidencias: lo terminado hace más de un año nace
    // archivado, salvo uno de cada ocho para probar el archivado a mano.
    const finished = issuedAt ?? decidedAt;
    const archivedAt =
      finished !== undefined && finished < cutoff && i % 8 !== 0
        ? Math.min(now - H, finished + DAY)
        : undefined;

    items.push({
      reference: formatReference("partRequest", sequence),
      requesterName: requester.name,
      requesterTeam: requester.team,
      ...(target ? { equipment: `${target.name} ${target.model}` } : {}),
      ...(target ? { equipmentId: target.id } : {}),
      priority: i % 5 === 0 ? "urgent" : i % 3 === 0 ? "low" : "normal",
      status,
      lines,
      ...(noCatalog ? { description: pick(rnd, FREE_REQUESTS) } : {}),
      notes: pick(rnd, REQUESTER_NOTES),
      ...(decision
        ? { decisionNote: decision, decidedBy: "Responsable de repuestos" }
        : {}),
      ...(decidedAt !== undefined ? { decidedAt } : {}),
      ...(issuedAt !== undefined ? { issuedAt } : {}),
      // La entrega tiene su propio motivo: la decisión y la entrega no son lo
      // mismo, aunque las firme la misma persona.
      ...(issuedAt !== undefined
        ? { issueNote: pick(rnd, DELIVERY_NOTES) }
        : {}),
      ...(archivedAt !== undefined
        ? { archivedAt, archivedBy: AUTO_ARCHIVE_BY }
        : {}),
      createdAt,
    });
  }

  return items;
}

/** Quien carga los datos debe poder modificar el catálogo de repuestos. */

/**
 * Quién puede cargar la muestra: quien modifica el catálogo de repuestos. El
 * mensaje vive aquí porque lo dicen dos sitios que no pueden compartir código: la
 * mutación —que mira los permisos con la base delante— y la acción que guarda las
 * fotos, que solo puede preguntarlo por una consulta interna.
 */
const SEED_PERMISSION_MESSAGE =
  "No tienes permisos para cargar los datos de ejemplo. Necesitas la capacidad de modificar los repuestos del catálogo.";

/** El aviso de sesión, igual para las dos puertas de la muestra. */
const SEED_SESSION_MESSAGE =
  "Debes iniciar sesión para cargar los datos de ejemplo.";

async function requireSeeder(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError(SEED_SESSION_MESSAGE);
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : SEED_SESSION_MESSAGE,
    );
  }
  if (!(await hasCapability(ctx, user, "manageInventory"))) {
    throw new ConvexError(SEED_PERMISSION_MESSAGE);
  }

  return user;
}

/**
 * Inserta lo que falte del catálogo de ejemplo (equipos y repuestos) sin
 * duplicar códigos: sirve tanto para la primera carga como para completar una
 * instalación que ya tenía una muestra más corta.
 */
async function ensureCatalog(
  ctx: MutationCtx,
  now: number,
): Promise<{ equipment: number; parts: number }> {
  const existingEquipment = await ctx.db.query("equipment").collect();
  const equipmentIds: Record<string, Id<"equipment">> = {};
  for (const item of existingEquipment) {
    if (item.code) equipmentIds[item.code] = item._id;
  }

  let insertedEquipment = 0;
  for (const item of ALL_EQUIPMENT) {
    if (equipmentIds[item.code]) continue;
    const purchaseDate = monthsBack(item.purchaseMonthsAgo, now);
    const equipmentId = await ctx.db.insert("equipment", {
      code: item.code,
      brand: item.brand,
      name: item.name,
      model: item.model,
      location: item.location,
      ...(item.description ? { description: item.description } : {}),
      serialNumber: item.serialNumber,
      supplier: item.supplier,
      purchaseDate,
      warrantyEndDate: addMonths(purchaseDate, item.warrantyMonths),
      ...(item.decommissionMonthsAgo
        ? { decommissionDate: monthsBack(item.decommissionMonthsAgo, now) }
        : {}),
      maintenanceIntervalDays: item.maintenanceIntervalDays,
      createdAt: now,
      updatedAt: now,
    });
    equipmentIds[item.code] = equipmentId;
    insertedEquipment += 1;
  }

  const existingParts = await ctx.db.query("spareParts").collect();
  const takenCodes = new Set(existingParts.map((part) => part.code));
  let insertedParts = 0;
  for (const part of ALL_PARTS) {
    if (takenCodes.has(part.code)) continue;
    const codes = part.compatibleWith ?? COMPATIBILITY[part.code] ?? [];
    const compatibleWith = codes
      .map((code) => equipmentIds[code])
      .filter((id): id is Id<"equipment"> => id !== undefined);
    await ctx.db.insert("spareParts", {
      code: part.code,
      name: part.name,
      description: part.description,
      category: part.category,
      unit: part.unit,
      stock: part.stock,
      minStock: part.minStock,
      location: part.location,
      supplier: part.supplier,
      ...(part.partNumber ? { partNumber: part.partNumber } : {}),
      ...(part.unitPrice !== undefined ? { unitPrice: part.unitPrice } : {}),
      ...(compatibleWith.length > 0 ? { compatibleWith } : {}),
      createdAt: now,
      updatedAt: now,
    });
    takenCodes.add(part.code);
    insertedParts += 1;
  }

  return { equipment: insertedEquipment, parts: insertedParts };
}

/** Equipos (sin los dados de baja) y repuestos que usan los generadores. */
async function catalogRefs(
  ctx: MutationCtx,
): Promise<{ equipment: EquipmentRef[]; parts: PartRef[] }> {
  const byCode = new Map(
    ALL_EQUIPMENT.map((item) => [item.code, item] as const),
  );
  const equipmentDocs = await ctx.db.query("equipment").collect();
  const equipment: EquipmentRef[] = [];
  for (const doc of equipmentDocs) {
    const seed = doc.code ? byCode.get(doc.code) : undefined;
    // Los equipos de baja no generan incidencias nuevas.
    if (!seed || doc.decommissionDate !== undefined) continue;
    equipment.push({
      id: doc._id,
      code: seed.code,
      name: doc.name,
      model: doc.model,
      location: doc.location ?? seed.location,
      serialNumber: doc.serialNumber ?? seed.serialNumber,
      kind: seed.kind,
    });
  }
  const partDocs = await ctx.db.query("spareParts").collect();
  const parts: PartRef[] = partDocs.map((part) => ({
    id: part._id,
    code: part.code,
    name: part.name,
  }));
  return { equipment, parts };
}

/** Nombre visible de quien carga los datos: firma los documentos adjuntos. */
function seederName(user: Doc<"users">): string {
  return user.name?.trim() || user.email?.trim() || "Coordinación";
}

/** Nombres para asignar incidencias: los usuarios reales o la muestra fija. */
async function technicianNames(
  ctx: MutationCtx,
  actor: Doc<"users">,
): Promise<string[]> {
  const users = await ctx.db.query("users").collect();
  const names = users
    .filter((user) => user.active !== false && user._id !== actor._id)
    .map((user) => user.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names : MOCK_TECHS;
}

/**
 * Quiénes firman los movimientos de documentos de la muestra: quien carga los
 * datos y, después, los compañeros que también pueden gestionar una incidencia,
 * que es el mismo permiso que hace falta para adjuntar, editar o quitar un
 * documento. El rastro de auditoría enseña así relevos entre coordinadores en
 * vez de firmar siempre la misma persona; con un único administrador, firma él.
 */
async function documentSigners(
  ctx: MutationCtx,
  actor: Doc<"users">,
): Promise<{ id: Id<"users">; name: string }[]> {
  const users = await ctx.db.query("users").collect();
  const signers: { id: Id<"users">; name: string }[] = [
    { id: actor._id, name: seederName(actor) },
  ];
  // Los permisos se resuelven por rol: se pregunta una vez por rol distinto.
  const allowedByRole = new Map<string, boolean>();
  for (const user of users) {
    if (user._id === actor._id || user.active === false) continue;
    const key = user.role ?? DEFAULT_ROLE;
    let allowed = allowedByRole.get(key);
    if (allowed === undefined) {
      allowed = await roleCan(ctx, key, "manageIncidents");
      allowedByRole.set(key, allowed);
    }
    if (!allowed) continue;
    signers.push({
      id: user._id,
      name: user.name?.trim() || user.email?.trim() || "Usuario del taller",
    });
  }
  return signers;
}

/** Incidencias cerradas con equipo: dejan su ficha de historial en el equipo. */
async function insertIncidentMaintenance(
  ctx: MutationCtx,
  now: number,
  incidents: GeneratedIncident[],
  incidentIds: Record<string, Id<"incidents">>,
): Promise<number> {
  let created = 0;
  for (const incident of incidents) {
    if (incident.status !== "resolved" && incident.status !== "unresolved") {
      continue;
    }
    if (!incident.equipmentId || incident.closedAt === undefined) continue;
    const incidentId = incidentIds[incident.reference];
    if (!incidentId) continue;
    const maintenanceId = await ctx.db.insert("maintenanceRecords", {
      equipmentId: incident.equipmentId,
      kind: "repair",
      title: `${incident.equipmentKind} ${incident.model}`.trim(),
      description: incident.notes
        ? `${incident.description} · ${incident.notes}`
        : incident.description,
      performedAt: incident.closedAt,
      ...(incident.assigneeName ? { technician: incident.assigneeName } : {}),
      createdAt: now,
      updatedAt: now,
    });
    // La ficha se enlaza desde la incidencia cerrada.
    await ctx.db.patch(incidentId, { maintenanceId });
    created += 1;
  }
  return created;
}

/**
 * Plan de mantenimiento preventivo de cada equipo: una revisión por intervalo
 * desde el alta (como mucho las tres últimas). Con `late`, la última revisión
 * se queda atrás y el equipo aparece con la revisión vencida.
 */
async function insertPreventivePlan(
  ctx: MutationCtx,
  now: number,
  codes: readonly string[],
): Promise<number> {
  const byCode = new Map(
    ALL_EQUIPMENT.map((item) => [item.code, item] as const),
  );
  const equipmentDocs = await ctx.db.query("equipment").collect();
  const records = await ctx.db.query("maintenanceRecords").collect();
  const withPreventive = new Set(
    records
      .filter((record) => record.kind === "preventive")
      .map((record) => record.equipmentId),
  );

  let created = 0;
  for (const doc of equipmentDocs) {
    const seed = doc.code ? byCode.get(doc.code) : undefined;
    if (!seed || !codes.includes(seed.code)) continue;
    if (withPreventive.has(doc._id)) continue;
    const interval = seed.maintenanceIntervalDays * DAY;
    if (interval <= 0) continue;
    const purchaseDate =
      doc.purchaseDate ?? monthsBack(seed.purchaseMonthsAgo, now);
    const last = seed.late ? now - interval : now;
    const dates: number[] = [];
    for (let at = purchaseDate + interval; at <= last; at += interval) {
      dates.push(at);
      if (dates.length > 60) break;
    }
    const plan = dates.slice(-3);
    for (let i = 0; i < plan.length; i += 1) {
      const performedAt = plan[i];
      if (performedAt === undefined) continue;
      await ctx.db.insert("maintenanceRecords", {
        equipmentId: doc._id,
        kind: "preventive",
        title:
          PREVENTIVE_TITLES[i % PREVENTIVE_TITLES.length] ??
          "Revisión preventiva",
        description: PREVENTIVE_NOTES[i % PREVENTIVE_NOTES.length],
        performedAt,
        technician: MOCK_TECHS[i % MOCK_TECHS.length] ?? "Servicio técnico",
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }
  }
  return created;
}

/** Avisos in-app de ejemplo para quien carga los datos (su propia campana). */
async function insertNotifications(
  ctx: MutationCtx,
  userId: Id<"users">,
  incidents: GeneratedIncident[],
): Promise<number> {
  const open = incidents
    .filter((incident) => incident.status === "reported")
    .sort((a, b) => b.reportedAt - a.reportedAt)
    .slice(0, 5);
  if (open.length === 0) return 0;

  let created = 0;
  for (let i = 0; i < open.length; i += 1) {
    const incident = open[i];
    if (!incident) continue;
    const read = i >= 3;
    await ctx.db.insert("notifications", {
      userId,
      text: `Nueva incidencia ${incident.reference}: ${incident.equipmentKind} ${incident.model}`,
      read,
      createdAt: incident.reportedAt + H,
    });
    created += 1;
  }

  const assigned = incidents
    .filter((incident) => incident.status === "assigned")
    .sort((a, b) => b.reportedAt - a.reportedAt)
    .slice(0, 3);
  for (const incident of assigned) {
    await ctx.db.insert("notifications", {
      userId,
      text: `Incidencia ${incident.reference} asignada a ${incident.assigneeName ?? "taller"}`,
      read: true,
      createdAt: incident.reportedAt + 2 * H,
    });
    created += 1;
  }

  return created;
}

/** Conversación de ejemplo con otro miembro del taller, si ya hay alguno. */
async function insertMessages(
  ctx: MutationCtx,
  actor: Doc<"users">,
  now: number,
): Promise<number> {
  const users = await ctx.db.query("users").collect();
  const other = users.find(
    (user) => user._id !== actor._id && user.active !== false,
  );
  if (!other) return 0;

  const actorName = actor.name?.trim() || actor.email?.trim() || "Coordinación";
  const otherName = other.name?.trim() || other.email?.trim() || "Taller";
  const thread: { from: "actor" | "other"; text: string; hoursAgo: number }[] =
    [
      {
        from: "other",
        text: "¿Puedes mirar el router del rack central? Sigue perdiendo señal en el plató 2.",
        hoursAgo: 30,
      },
      {
        from: "actor",
        text: "Sí, lo tengo en la cola. He pedido el repuesto del panel de parcheo.",
        hoursAgo: 27,
      },
      {
        from: "other",
        text: "Perfecto. ¿Llegamos al directo del sábado?",
        hoursAgo: 26,
      },
      {
        from: "actor",
        text: "Con el material que hay en almacén lo dejamos listo. Si falta algo, hago la petición hoy.",
        hoursAgo: 25,
      },
      {
        from: "other",
        text: "Gracias. Te dejo dicho al equipo de plató que la cámara 1 está en taller.",
        hoursAgo: 6,
      },
    ];

  let created = 0;
  for (const message of thread) {
    const from = message.from === "actor" ? actor : other;
    const to = message.from === "actor" ? other : actor;
    await ctx.db.insert("messages", {
      senderId: from._id,
      senderName: message.from === "actor" ? actorName : otherName,
      recipientId: to._id,
      recipientName: message.from === "actor" ? otherName : actorName,
      text: message.text,
      read: true,
      readAt: now - message.hoursAgo * H + MIN,
      createdAt: now - message.hoursAgo * H,
    });
    created += 1;
  }
  return created;
}

/** Inserta un bloque de trabajo (incidencias, peticiones y sus fichas). */
async function insertWorkload(
  ctx: MutationCtx,
  opts: {
    now: number;
    incidents: number;
    requests: number;
    equipment: EquipmentRef[];
    parts: PartRef[];
    technicians: string[];
    /**
     * Quiénes firman los movimientos de documentos: el primero es quien carga
     * la muestra y el resto, los compañeros que también coordinan el taller.
     */
    signers: { id: Id<"users">; name: string }[];
  },
): Promise<{
  incidents: number;
  requests: number;
  maintenance: number;
  generatedIncidents: GeneratedIncident[];
}> {
  const { now, equipment, parts, technicians } = opts;

  const incidentDocs = await ctx.db.query("incidents").collect();
  const requestDocs = await ctx.db.query("partRequests").collect();

  const generatedIncidents = buildIncidents({
    startSequence: nextSequence(
      "incident",
      incidentDocs.map((item) => item.reference),
    ),
    count: opts.incidents,
    now,
    seed: 20261007 + incidentDocs.length,
    equipment,
    technicians,
    signers: opts.signers,
  });
  const incidentIds: Record<string, Id<"incidents">> = {};
  for (const incident of generatedIncidents) {
    // Los documentos se crean en su tabla y se referencian desde la ficha,
    // igual que hace `attachDocument` en el ciclo real.
    const { documents, ...rest } = incident;
    const incidentId = await ctx.db.insert("incidents", rest);
    incidentIds[incident.reference] = incidentId;
    if (documents && documents.length > 0) {
      const stored: Doc<"incidents">["documents"] = [];
      for (const doc of documents) {
        const documentId = await ctx.db.insert("incidentDocuments", {
          incidentId,
          name: doc.name,
          ...(doc.note ? { note: doc.note } : {}),
          author: doc.author,
          createdAt: doc.createdAt,
        });
        // El rastro se escribe con las mismas piezas que en el ciclo real: el
        // alta al adjuntarlo y, si toca, la edición o la retirada posterior.
        await ctx.db.insert("incidentDocumentLog", {
          incidentId,
          documentId,
          action: DOCUMENT_ACTIONS.ATTACHED,
          name: doc.previousName ?? doc.name,
          by: doc.author,
          byId: doc.byId,
          at: doc.createdAt,
        });
        if (doc.renamedAt !== undefined && doc.previousName) {
          await ctx.db.insert("incidentDocumentLog", {
            incidentId,
            documentId,
            action: DOCUMENT_ACTIONS.EDITED,
            name: doc.name,
            previousName: doc.previousName,
            by: doc.author,
            byId: doc.byId,
            at: doc.renamedAt,
          });
        }
        if (doc.removedAt !== undefined) {
          await ctx.db.insert("incidentDocumentLog", {
            incidentId,
            documentId,
            action: DOCUMENT_ACTIONS.REMOVED,
            name: doc.name,
            by: doc.author,
            byId: doc.byId,
            at: doc.removedAt,
          });
          // Retirado: la fila se va y la traza se queda, igual que cuando se
          // quita un adjunto desde la aplicación.
          await ctx.db.delete(documentId);
          continue;
        }
        stored.push({
          _id: documentId,
          name: doc.name,
          ...(doc.note ? { note: doc.note } : {}),
          author: doc.author,
          createdAt: doc.createdAt,
        });
      }
      if (stored.length > 0) {
        await ctx.db.patch(incidentId, { documents: stored });
      }
    }
  }
  // Las incidencias cerradas dejan su ficha de historial en el equipo.
  const maintenance = await insertIncidentMaintenance(
    ctx,
    now,
    generatedIncidents,
    incidentIds,
  );

  const generatedRequests = buildRequests({
    startSequence: nextSequence(
      "partRequest",
      requestDocs.map((item) => item.reference),
    ),
    count: opts.requests,
    now,
    seed: 77102026 + requestDocs.length,
    equipment,
    parts,
  });
  for (const request of generatedRequests) {
    await ctx.db.insert("partRequests", request);
  }

  return {
    incidents: generatedIncidents.length,
    requests: generatedRequests.length,
    maintenance,
    generatedIncidents,
  };
}

/* ------------------------------------------------------------------ */
/* Mutaciones                                                          */
/* ------------------------------------------------------------------ */

/** Muestra curada (la historia del taller) sobre el catálogo ya insertado. */
async function insertCuratedSamples(
  ctx: MutationCtx,
  now: number,
  equipmentIds: Record<string, Id<"equipment">>,
) {
  const parts = await ctx.db.query("spareParts").collect();
  const ids: Record<string, Id<"spareParts">> = {};
  for (const part of parts) ids[part.code] = part._id;

  const requestIds: Record<string, Id<"partRequests">> = {};
  for (const request of seedRequests(ids, now)) {
    const { equipmentCode, ...rest } = request;
    const equipmentId = equipmentIds[equipmentCode];
    const requestId = await ctx.db.insert("partRequests", {
      ...rest,
      ...(equipmentId ? { equipmentId } : {}),
    });
    requestIds[request.reference] = requestId;
  }

  for (const item of SEED_MAINTENANCE) {
    const { equipmentCode, daysAgo, requestReference, ...rest } = item;
    const equipmentId = equipmentIds[equipmentCode];
    if (!equipmentId) continue;
    const requestId = requestReference
      ? requestIds[requestReference]
      : undefined;
    await ctx.db.insert("maintenanceRecords", {
      equipmentId,
      kind: rest.kind,
      title: rest.title,
      ...(rest.description ? { description: rest.description } : {}),
      performedAt: now - daysAgo * 24 * 60 * 60 * 1000,
      ...(rest.technician ? { technician: rest.technician } : {}),
      ...(requestId ? { requestId } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Incidencias de ejemplo, con el trazo de cada paso en su ficha
  for (const item of SEED_INCIDENTS) {
    const { equipmentCode, hoursAgo, ...rest } = item;
    const equipmentId = equipmentIds[equipmentCode];
    const reportedAt = now - hoursAgo * H;
    const history: Doc<"incidents">["history"] = [
      { status: "reported", at: reportedAt, by: rest.reporterName },
    ];
    if (rest.status !== "reported" && rest.assigneeName) {
      history.push({
        status: "assigned",
        at: reportedAt + H,
        by: rest.assigneeName,
        ...(rest.status === "workshop"
          ? { note: "Autoasignada por el técnico" }
          : {}),
      });
    }
    if (rest.status === "workshop") {
      const byName = rest.workshopAssigneeName ?? rest.assigneeName;
      history.push({
        status: "workshop",
        at: reportedAt + 2 * H,
        ...(byName ? { by: byName } : {}),
        note: "Derivada a taller",
      });
    }
    await ctx.db.insert("incidents", {
      ...rest,
      ...(equipmentId ? { equipmentId } : {}),
      reportedAt,
      history,
      createdAt: reportedAt,
      updatedAt: reportedAt + (history.length - 1) * H,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Las fotos que el formulario público dejó sin usar                   */
/* ------------------------------------------------------------------ */

/**
 * La muestra incluye fotos abandonadas del formulario público —las que alguien
 * subió, acreditó con su vale y ninguna incidencia llegó a citar—, que son las
 * que la limpieza de la madrugada se encuentra y barre. Sin ellas, el almacén de
 * un taller recién instalado sale vacío y la tarjeta de Ajustes del taller no
 * tiene nada que enseñar.
 *
 * Guardarlas no cabe en la mutación de la muestra: escribir un archivo en el
 * almacén (`ctx.storage.store`) solo se puede hacer desde una acción, y una
 * acción no toca la base de datos. Así que esto va en tres piezas, como el resto
 * de las subidas de la aplicación: la acción guarda los archivos, la mutación
 * interna apunta las filas que los citan y la consulta interna deja a la acción
 * saber si puede hacerlo y qué le falta por guardar.
 */

/**
 * Lo que la acción necesita saber antes de guardar nada: si quien la llama puede
 * cargar la muestra y qué fotos no están todavía. Las dos cosas se preguntan de
 * una vez porque una acción no puede leer la base de datos por su cuenta, y
 * llevan al mismo sitio: sin permiso no se guarda nada, y con él solo lo que
 * falte —la acción se puede volver a pulsar sin llenar el almacén de copias—.
 */
export const sampleUploadsContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (
      !user ||
      user.active === false ||
      user.isAnonymous === true ||
      !(await hasCapability(ctx, user, "manageInventory"))
    ) {
      return { allowed: false, missing: [] as string[] };
    }

    const rows = await ctx.db.query("reportUploads").collect();
    const existing = new Set(rows.map((row) => row.ticket));
    return {
      allowed: true,
      missing: SAMPLE_PHOTOS.filter((photo) => !existing.has(photo.ticket)).map(
        (photo) => photo.ticket,
      ),
    };
  },
});

/**
 * Apunta las fotos que la acción acaba de guardar: una fila por vale, como las
 * del formulario de verdad —acreditada y sin citar en ninguna incidencia—, para
 * que el almacén las vea como lo que son y la limpieza sepa de qué incidencia no
 * las cita nadie.
 *
 * No duplica: un vale que ya esté apuntado se deja como está, así que pulsar la
 * muestra dos veces no multiplica las filas.
 */
export const recordSampleUploads = internalMutation({
  args: {
    uploads: v.array(
      v.object({
        ticket: v.string(),
        storageId: v.id("_storage"),
        createdAt: v.number(),
        claimedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("reportUploads").collect();
    const existing = new Set(rows.map((row) => row.ticket));

    let inserted = 0;
    for (const upload of args.uploads) {
      if (existing.has(upload.ticket)) continue;
      await ctx.db.insert("reportUploads", upload);
      inserted += 1;
    }
    return inserted;
  },
});

/**
 * Guarda las fotos abandonadas del formulario que le faltan a la muestra y las
 * apunta con su vale. Es la mitad de la muestra que no cabe en una mutación, y va
 * con la otra: el botón de «Cargar datos de ejemplo» la llama primero (y también
 * el de «Más datos de ejemplo», que así se las añade a las instalaciones que ya
 * tenían muestra de antes).
 *
 * Cada foto se guarda con su fecha de hace unos días —más de la ventana de
 * cortesía del formulario—, así que desde el primer momento son las que la
 * limpieza de la noche se va a llevar: es lo que se quiere poder mirar en
 * Ajustes del taller. Se salta las que ya estén apuntadas, así que pulsar de
 * nuevo no llena el almacén de copias, y devuelve cuántas ha guardado y cuántas
 * son en total, que es lo que cuenta el aviso que ve quien carga la muestra.
 */
export const seedDemoUploads = action({
  args: {},
  // El tipo va escrito a mano: la acción llama a la mutación que apunta sus
  // filas, y las dos se referencian en círculo a través de la API generada, así
  // que sin él TypeScript no sabe qué devuelve. (El proyecto no usa validadores
  // de salida: el contrato lo deja escrito el tipo.)
  handler: async (ctx): Promise<{ uploaded: number; total: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError(SEED_SESSION_MESSAGE);

    const { allowed, missing } = await ctx.runQuery(
      internal.seed.sampleUploadsContext,
      { userId },
    );
    if (!allowed) throw new ConvexError(SEED_PERMISSION_MESSAGE);

    const now = Date.now();
    const uploads: {
      ticket: string;
      storageId: Id<"_storage">;
      createdAt: number;
      claimedAt: number;
    }[] = [];
    for (const photo of SAMPLE_PHOTOS) {
      if (!missing.includes(photo.ticket)) continue;
      const createdAt = now - photo.ageDays * DAY;
      uploads.push({
        ticket: photo.ticket,
        // El archivo se guarda aquí, en la acción: una mutación no puede escribir
        // en el almacén, solo apuntar lo que otro guardó.
        storageId: await ctx.storage.store(
          new Blob([samplePhotoBytes(photo)], { type: "image/png" }),
        ),
        createdAt,
        // Acreditada poco después de subirse: es lo que la hace una imagen del
        // formulario y no un archivo suelto que nadie reclamó.
        claimedAt: createdAt + 3 * MIN,
      });
    }

    if (uploads.length === 0) {
      return { uploaded: 0, total: SAMPLE_PHOTOS.length };
    }
    const uploaded = await ctx.runMutation(internal.seed.recordSampleUploads, {
      uploads,
    });
    return { uploaded, total: SAMPLE_PHOTOS.length };
  },
});

/* ------------------------------------------------------------------ */
/* Los manuales de la muestra                                          */
/* ------------------------------------------------------------------ */

/**
 * La muestra también trae manuales: la documentación de algunos equipos del
 * inventario y unas cuantas notas del taller, para que el módulo de manuales no
 * nazca vacío. Vale lo mismo que con las fotos del formulario —los PDF hay que
 * guardarlos en el almacén y eso solo se puede hacer desde una acción—, así que
 * va en las mismas tres piezas: la consulta interna deja a la acción saber si
 * puede y qué falta; la acción compone y guarda los PDF; y la mutación interna
 * apunta las fichas que los citan, resolviendo a qué equipo del inventario va
 * cada manual.
 *
 * Los manuales van después de la mutación de la muestra, no antes: la mitad se
 * asignan a equipos del inventario y esos equipos los crea `seedDemoData`. Como
 * la acción no repite lo que ya está —mira los títulos—, los dos botones de la
 * muestra se la pueden pedir sin llenar el módulo de copias.
 */

/**
 * Lo que la acción necesita saber antes de guardar nada: si quien la llama puede
 * gestionar los manuales y qué manuales de la muestra no están todavía. Las dos
 * cosas de una vez, como en las fotos del formulario: sin permiso no se guarda
 * nada y, con él, solo lo que falte.
 */
export const sampleManualsContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !(await hasCapability(ctx, user, "manageManuals"))) {
      return { allowed: false, missing: [] as string[] };
    }

    const rows = await ctx.db.query("manuals").collect();
    const titles = new Set(rows.map((row) => row.title));
    return {
      allowed: true,
      // Un manual de la muestra que ya esté por su título no se vuelve a crear.
      missing: SAMPLE_MANUALS.filter((manual) => !titles.has(manual.title)).map(
        (manual) => manual.code,
      ),
    };
  },
});

/** Lo que el almacén sabe de un archivo de la muestra ya guardado. */
async function sampleFile(ctx: MutationCtx, storageId: Id<"_storage">) {
  const file = await ctx.db.system.get("_storage", storageId);
  if (!file) {
    throw new ConvexError("El archivo de un manual de la muestra no llegó.");
  }
  return {
    contentType: file.contentType ?? "application/pdf",
    size: file.size,
  };
}

/**
 * Apunta los manuales que la acción acaba de guardar: la ficha con su
 * clasificación —heredando el equipo del inventario al que apunta—, su nota si
 * la lleva, y el historial del alta. El manual que la muestra da por sustituido
 * nace además con la versión anterior guardada en su historial, para que la
 * ficha enseñe el historial de cambios desde el primer día.
 *
 * No duplica: un manual que ya esté —por su título— se deja como está, así que
 * pulsar la muestra dos veces no multiplica las fichas.
 */
export const recordSampleManuals = internalMutation({
  args: {
    userId: v.id("users"),
    manuals: v.array(
      v.object({
        code: v.string(),
        createdAt: v.number(),
        storageId: v.optional(v.id("_storage")),
        /** La versión anterior del archivo, si el manual ya se sustituyó. */
        previousStorageId: v.optional(v.id("_storage")),
        /** Cuándo se sustituyó (para la fecha del movimiento del historial). */
        replacedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError(SEED_SESSION_MESSAGE);
    const author =
      user.name?.trim() || user.email?.trim() || "Usuario del taller";

    const equipmentDocs = await ctx.db.query("equipment").collect();
    const equipmentIds: Record<string, Id<"equipment">> = {};
    for (const doc of equipmentDocs) {
      if (doc.code) equipmentIds[doc.code] = doc._id;
    }

    const rows = await ctx.db.query("manuals").collect();
    const titles = new Set(rows.map((row) => row.title));

    let inserted = 0;
    for (const entry of args.manuals) {
      const sample = SAMPLE_MANUALS.find((item) => item.code === entry.code);
      if (!sample || titles.has(sample.title)) continue;

      const equipmentId = sample.equipmentCode
        ? equipmentIds[sample.equipmentCode]
        : undefined;
      const notes = richDocToStore(sample.notes);
      const file = entry.storageId
        ? await sampleFile(ctx, entry.storageId)
        : null;

      const history: NonNullable<Doc<"manuals">["history"]> = [
        { at: entry.createdAt, action: "created", by: author, byId: user._id },
      ];
      if (entry.previousStorageId) {
        const previous = await sampleFile(ctx, entry.previousStorageId);
        history.push({
          at: entry.replacedAt ?? entry.createdAt,
          action: "fileReplaced",
          by: author,
          byId: user._id,
          file: {
            storageId: entry.previousStorageId,
            fileName: sample.previousFileName ?? "Manual.pdf",
            contentType: previous.contentType,
            size: previous.size,
          },
        });
      }

      await ctx.db.insert("manuals", {
        title: sample.title,
        kind: file ? "file" : "note",
        type: sample.type,
        ...(sample.brand ? { brand: sample.brand } : {}),
        ...(sample.model ? { model: sample.model } : {}),
        ...(equipmentId ? { equipmentId } : {}),
        ...(file && entry.storageId
          ? {
              storageId: entry.storageId,
              fileName: sample.file?.fileName ?? "Manual.pdf",
              contentType: file.contentType,
              size: file.size,
            }
          : {}),
        ...(notes ? { notes } : {}),
        author,
        authorId: user._id,
        history,
        createdAt: entry.createdAt,
        // El manual ya sustituido se tocó por última vez al reemplazarlo.
        updatedAt: entry.replacedAt ?? entry.createdAt,
      });
      titles.add(sample.title);
      inserted += 1;
    }
    return inserted;
  },
});

/**
 * Guarda los PDF de los manuales de la muestra y apunta sus fichas. Es la mitad
 * de la muestra que no cabe en una mutación, como las fotos del formulario.
 *
 * Va después de la mutación de la muestra: los manuales que se asignan a un
 * equipo necesitan que el inventario ya esté cargado. Y no duplica —salta los
 * que ya estén por su título—, así que los dos botones pueden pedirla sin miedo.
 */
export const seedDemoManuals = action({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; total: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError(SEED_SESSION_MESSAGE);

    const { allowed, missing } = await ctx.runQuery(
      internal.seed.sampleManualsContext,
      { userId },
    );
    if (!allowed) throw new ConvexError(SEED_PERMISSION_MESSAGE);

    const now = Date.now();
    const manuals: {
      code: string;
      createdAt: number;
      storageId?: Id<"_storage">;
      previousStorageId?: Id<"_storage">;
      replacedAt?: number;
    }[] = [];
    for (const sample of SAMPLE_MANUALS) {
      if (!missing.includes(sample.code)) continue;
      const createdAt = now - sample.ageDays * DAY;
      // La versión anterior se sustituyó a mitad de camino entre el alta y hoy:
      // el manual se subió, se cambió y así sigue.
      const replacedAt =
        sample.previousFileName !== undefined
          ? createdAt + Math.floor((now - createdAt) / 2)
          : undefined;
      const storageId = sample.file
        ? await ctx.storage.store(
            new Blob([sampleManualPdf(sample)], { type: "application/pdf" }),
          )
        : undefined;
      const previousStorageId =
        sample.previousFileName !== undefined
          ? await ctx.storage.store(
              new Blob([sampleManualPdf(sample, "previous")], {
                type: "application/pdf",
              }),
            )
          : undefined;
      manuals.push({
        code: sample.code,
        createdAt,
        ...(storageId ? { storageId } : {}),
        ...(previousStorageId ? { previousStorageId } : {}),
        ...(replacedAt !== undefined ? { replacedAt } : {}),
      });
    }

    if (manuals.length === 0) {
      return { inserted: 0, total: SAMPLE_MANUALS.length };
    }
    const inserted = await ctx.runMutation(internal.seed.recordSampleManuals, {
      userId,
      manuals,
    });
    return { inserted, total: SAMPLE_MANUALS.length };
  },
});

/**
 * Carga la muestra completa la primera vez (idempotente): catálogo, equipos,
 * peticiones de todos los estados, incidencias de todo el flujo, historial de
 * mantenimiento, avisos y una conversación de ejemplo. Lo que no cabe en una
 * mutación va en las dos acciones de la muestra: `seedDemoUploads` guarda las
 * fotos abandonadas del formulario y `seedDemoManuals` los PDF de los manuales.
 *
 * Las tres piezas se piden juntas desde el panel: primero esto —que es lo que
 * deja el inventario— y después las dos acciones.
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireSeeder(ctx);

    const flag = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "seeded"))
      .unique();
    if (flag?.seeded) return false;

    const now = Date.now();
    await ensureCatalog(ctx, now);

    const equipmentDocs = await ctx.db.query("equipment").collect();
    const equipmentIds: Record<string, Id<"equipment">> = {};
    for (const doc of equipmentDocs) {
      if (doc.code) equipmentIds[doc.code] = doc._id;
    }

    await insertCuratedSamples(ctx, now, equipmentIds);

    const { equipment, parts } = await catalogRefs(ctx);
    const technicians = await technicianNames(ctx, user);
    const workload = await insertWorkload(ctx, {
      now,
      incidents: INITIAL_INCIDENTS,
      requests: INITIAL_REQUESTS,
      equipment,
      parts,
      technicians,
      signers: await documentSigners(ctx, user),
    });
    await insertPreventivePlan(
      ctx,
      now,
      ALL_EQUIPMENT.map((item) => item.code),
    );

    // Avisos de ejemplo en la campana de quien carga los datos y una charla
    // de taller con otro miembro, si ya lo hay.
    await insertNotifications(ctx, user._id, workload.generatedIncidents);
    await insertMessages(ctx, user, now);

    if (flag) {
      await ctx.db.patch(flag._id, { seeded: true });
    } else {
      await ctx.db.insert("appSettings", { key: "seeded", seeded: true });
    }
    return true;
  },
});

/**
 * Añade otra tanda de datos de ejemplo: completa lo que falte del catálogo y
 * genera más incidencias y peticiones con fechas repartidas entre hoy y hace
 * años. Se puede pulsar tantas veces como haga falta para tener volumen con el
 * que probar listados, filtros y archivo.
 */
export const seedMoreDemoData = mutation({
  args: {
    incidents: v.optional(v.number()),
    requests: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSeeder(ctx);
    const now = Date.now();

    const clamp = (value: number | undefined, fallback: number) =>
      Math.max(0, Math.min(200, Math.round(value ?? fallback)));

    const catalog = await ensureCatalog(ctx, now);
    const { equipment, parts } = await catalogRefs(ctx);
    const technicians = await technicianNames(ctx, user);
    const workload = await insertWorkload(ctx, {
      now,
      incidents: clamp(args.incidents, MORE_INCIDENTS),
      requests: clamp(args.requests, MORE_REQUESTS),
      equipment,
      parts,
      technicians,
      signers: await documentSigners(ctx, user),
    });
    // Los equipos nuevos (si los hubiera) también estrenan plan preventivo.
    const preventive = await insertPreventivePlan(
      ctx,
      now,
      ALL_EQUIPMENT.map((item) => item.code),
    );

    return { ...catalog, ...workload, preventive };
  },
});
