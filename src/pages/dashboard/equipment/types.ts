import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ManualRights } from "@/lib/manuals";
import type { ManualDoc } from "../ManualsView";

export type EquipmentDoc = Doc<"equipment">;
export type RecordDoc = Doc<"maintenanceRecords">;

export interface EquipmentViewProps {
  canManage?: boolean;
  canWriteManuals?: boolean;
  canManageManuals?: boolean;
  onNavigateToRequests?: (equipmentId: string) => void;
  openEquipmentId?: string | null;
  onEquipmentOpened?: () => void;
}

export interface EquipmentFormDialogProps {
  item: EquipmentDoc | null;
  initialValues?: {
    model?: string;
    serialNumber?: string;
    location?: string;
    modelId?: Id<"equipmentModels">;
    brand?: string;
    name?: string;
    supplier?: string;
    maintenanceIntervalDays?: number;
    description?: string;
  };
  onSuccess?: (createdId: Id<"equipment">) => void;
  onClose: () => void;
}

export interface MaintenanceDialogProps {
  item: EquipmentDoc;
  /** Intervención a editar (null = alta nueva). */
  record: RecordDoc | null;
  requests: Doc<"partRequests">[];
  onClose: () => void;
}

export interface ManualRowProps {
  manual: ManualDoc;
  assigned: boolean;
  /** Qué puede hacer quien mira: la ficha se abre siempre, lo demás no. */
  rights: ManualRights;
  onView: (manual: ManualDoc) => void;
  onEdit: (manual: ManualDoc) => void;
  onDelete: (manual: ManualDoc) => void;
}

export interface EquipmentDetailSheetProps {
  item: EquipmentDoc;
  /** Instante en el que se abrió el detalle (para el estado de garantía). */
  openedAt: number;
  parts: Doc<"spareParts">[];
  requests: Doc<"partRequests">[];
  /** Historial propio de este equipo (opcional por tolerancia en caliente). */
  maintenance?: RecordDoc[];
  /** Manuales asignados al equipo y los de su marca y modelo (opcional). */
  manuals?: { assigned: ManualDoc[]; byModel: ManualDoc[] };
  /** Solo responsable/admin registran intervenciones (fail-closed). */
  canManage?: boolean;
  /** Puede añadir manuales al equipo desde aquí (consulta o gestión). */
  canAddManual?: boolean;
  /** Qué puede hacer quien mira con cada manual: corregirlo y retirarlo. */
  rights?: ManualRights;
  /** Abre el formulario del manual, con el equipo ya asignado. */
  onAddManual?: (item: EquipmentDoc) => void;
  /** Abre la ficha del manual sin salir de la del equipo. */
  onViewManual?: (manual: ManualDoc) => void;
  /** Corrige el manual en el mismo formulario que el módulo. */
  onEditManual?: (manual: ManualDoc) => void;
  /** Retira el manual, con su confirmación. */
  onDeleteManual?: (manual: ManualDoc) => void;
  onClose: () => void;
  onViewRequests: (equipmentId: string) => void;
  /** Los diálogos que se abren desde la ficha (manuales), dentro de su árbol. */
  children?: React.ReactNode;
}

export type EquipmentColumn =
  | "equipment"
  | "brand"
  | "serial"
  | "location"
  | "manuals"
  | "parts";

export interface EquipmentTableProps {
  columns: Record<EquipmentColumn, { label: string }>;
  sort: import("@/lib/tableSort").TableSort<EquipmentColumn> | null;
  onSortChange: (
    sort: import("@/lib/tableSort").TableSort<EquipmentColumn> | null,
  ) => void;
  areaRef: React.RefObject<HTMLDivElement | null>;
  resetKey: number;
  visible: EquipmentDoc[];
  canManage: boolean;
  reviewOf: (item: EquipmentDoc) => { state: string };
  manualsOf: (item: EquipmentDoc) => {
    assigned: ManualDoc[];
    byModel: ManualDoc[];
  };
  compatibleCount: (item: EquipmentDoc) => number;
  onViewDetail: (item: EquipmentDoc) => void;
  onDuplicate: (item: EquipmentDoc) => void;
  onEdit: (item: EquipmentDoc) => void;
  onDelete: (item: EquipmentDoc) => void;
}

export interface EquipmentModalsProps {
  detail: { item: EquipmentDoc; openedAt: number } | null;
  parts: Doc<"spareParts">[];
  requests: Doc<"partRequests">[];
  equipment: EquipmentDoc[];
  maintenanceRecordsFor: (item: EquipmentDoc) => RecordDoc[];
  manualsOf: (item: EquipmentDoc) => {
    assigned: ManualDoc[];
    byModel: ManualDoc[];
  };
  canManage: boolean;
  canAddManual: boolean;
  canManageManuals: boolean;
  rights: ManualRights;
  formTarget: {
    item: EquipmentDoc | null;
    initialValues?: EquipmentFormDialogProps["initialValues"];
  } | null;
  deleteTarget: EquipmentDoc | null;
  manualForm: {
    manual: ManualDoc | null;
    equipmentId: Id<"equipment"> | null;
  } | null;
  manualDetail: ManualDoc | null;
  manualDelete: ManualDoc | null;
  onCloseDetail: () => void;
  onViewRequests: (equipmentId: string) => void;
  setManualForm: (
    target: {
      manual: ManualDoc | null;
      equipmentId: Id<"equipment"> | null;
    } | null,
  ) => void;
  setManualDetail: (manual: ManualDoc | null) => void;
  setManualDelete: (manual: ManualDoc | null) => void;
  closeForm: () => void;
  setDeleteTarget: (item: EquipmentDoc | null) => void;
}

