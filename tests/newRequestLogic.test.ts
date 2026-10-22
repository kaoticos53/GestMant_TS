import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildAttachmentsPayload,
  resolveEquipmentText,
  validateNewRequest,
} from "@/pages/dashboard/requests/hooks/useNewRequestForm";
import {
  filterCompatibleParts,
  resolveModelId,
  resolveSelectedEquipment,
  sanitizeQuantity,
} from "@/pages/dashboard/requests/hooks/useRequestPartsSelection";
import type { EquipmentDoc, PartDoc } from "@/pages/dashboard/requests/types";
import type { PendingRequestFile } from "@/pages/dashboard/requests/hooks/useRequestAttachments";

describe("Validación de Nueva Petición de Repuesto (validateNewRequest)", () => {
  const baseValid = {
    requesterName: "Carlos Técnico",
    hasLines: true,
    isDescriptionEmpty: true,
    hasAttachments: false,
    isUploading: false,
    equipmentChoice: "eq-1",
    equipmentText: "Cámara Sony A1",
  };

  it("rechaza si el nombre del solicitante está vacío o solo tiene espacios", () => {
    const error = validateNewRequest({
      ...baseValid,
      requesterName: "   ",
    });
    expect(error).toBe("Indica quién solicita el repuesto.");
  });

  it("rechaza si no hay líneas, ni descripción, ni archivos adjuntos", () => {
    const error = validateNewRequest({
      ...baseValid,
      hasLines: false,
      isDescriptionEmpty: true,
      hasAttachments: false,
    });
    expect(error).toContain("Añade un repuesto del catálogo o describe lo que necesitas");
  });

  it("acepta si no hay líneas pero sí hay descripción", () => {
    const error = validateNewRequest({
      ...baseValid,
      hasLines: false,
      isDescriptionEmpty: false,
      hasAttachments: false,
    });
    expect(error).toBeNull();
  });

  it("acepta si no hay líneas pero sí hay archivos adjuntos subidos", () => {
    const error = validateNewRequest({
      ...baseValid,
      hasLines: false,
      isDescriptionEmpty: true,
      hasAttachments: true,
    });
    expect(error).toBeNull();
  });

  it("rechaza si hay archivos que aún se están subiendo", () => {
    const error = validateNewRequest({
      ...baseValid,
      isUploading: true,
    });
    expect(error).toBe("Espera a que se suban los archivos adjuntos.");
  });

  it("rechaza si un archivo dio error al subir", () => {
    const error = validateNewRequest({
      ...baseValid,
      failedFileName: "foto_averia.png",
    });
    expect(error).toContain("No se ha podido subir «foto_averia.png»");
  });

  it("rechaza si se eligió entrada manual de equipo pero el texto está vacío", () => {
    const error = validateNewRequest({
      ...baseValid,
      equipmentChoice: "manual",
      equipmentText: "",
    });
    expect(error).toBe("Escribe el equipo afectado o elige uno del inventario.");
  });

  it("acepta si se eligió entrada manual de equipo con texto válido", () => {
    const error = validateNewRequest({
      ...baseValid,
      equipmentChoice: "manual",
      equipmentText: "Mesa de sonido Yamaha QL5",
    });
    expect(error).toBeNull();
  });
});

describe("Resolución de Equipo y Modelo", () => {
  const dummyEquipment: EquipmentDoc[] = [
    {
      _id: "eq-1" as Id<"equipment">,
      _creationTime: 1234,
      name: "Cámara",
      model: "Sony FX9",
      brand: "Sony",
      serialNumber: "SN-100",
      type: "ENG",
      location: "Plató 1",
      status: "operational",
    },
    {
      _id: "eq-2" as Id<"equipment">,
      _creationTime: 1235,
      name: "Mesa",
      model: "Yamaha QL5",
      modelId: "model-yamaha" as Id<"equipmentModels">,
      brand: "Yamaha",
      type: "Audio",
      status: "operational",
    },
  ];

  it("encuentra el equipo del inventario por ID", () => {
    const found = resolveSelectedEquipment(dummyEquipment, "eq-1");
    expect(found?._id).toBe("eq-1");
  });

  it("devuelve undefined si la opción es manual o vacía", () => {
    expect(resolveSelectedEquipment(dummyEquipment, "manual")).toBeUndefined();
    expect(resolveSelectedEquipment(dummyEquipment, "")).toBeUndefined();
  });

  it("resuelve modelId desde la propiedad directa del equipo si existe", () => {
    const modelId = resolveModelId(dummyEquipment[1], []);
    expect(modelId).toBe("model-yamaha");
  });

  it("resuelve modelId emparejando por nombre de modelo si el equipo no tiene modelId", () => {
    const catalog = [
      { _id: "model-sony-fx9" as Id<"equipmentModels">, model: "sony fx9" },
    ];
    const modelId = resolveModelId(dummyEquipment[0], catalog);
    expect(modelId).toBe("model-sony-fx9");
  });

  it("resuelve el texto del equipo correctamente", () => {
    expect(resolveEquipmentText(dummyEquipment[0], "eq-1", "")).toBe("Cámara Sony FX9");
    expect(resolveEquipmentText(undefined, "manual", "   Router Grass Valley  ")).toBe("Router Grass Valley");
    expect(resolveEquipmentText(undefined, "", "")).toBe("");
  });
});

describe("Compatibilidad de Repuestos y Cantidades", () => {
  const dummyParts: PartDoc[] = [
    {
      _id: "part-1" as Id<"spareParts">,
      _creationTime: 1000,
      code: "FUS-01",
      name: "Fusible 2A",
      stock: 10,
      minStock: 2,
      compatibleModels: ["model-yamaha" as Id<"equipmentModels">],
    },
    {
      _id: "part-2" as Id<"spareParts">,
      _creationTime: 1001,
      code: "OPT-02",
      name: "Sensor Óptico",
      stock: 5,
      minStock: 1,
      compatibleModels: ["model-sony" as Id<"equipmentModels">],
    },
    {
      _id: "part-3" as Id<"spareParts">,
      _creationTime: 1002,
      code: "CAB-03",
      name: "Cable BNC genérico",
      stock: 50,
      minStock: 10,
    },
  ];

  it("filtra únicamente los repuestos compatibles con el modelo indicado", () => {
    const compatible = filterCompatibleParts(dummyParts, "model-yamaha" as Id<"equipmentModels">);
    expect(compatible.map((p) => p.code)).toEqual(["FUS-01"]);
  });

  it("devuelve todo el catálogo si modelId es undefined", () => {
    const all = filterCompatibleParts(dummyParts, undefined);
    expect(all.length).toBe(3);
  });

  it("sanitiza cantidades garantizando enteros positivos >= 1", () => {
    expect(sanitizeQuantity(0)).toBe(1);
    expect(sanitizeQuantity(-5)).toBe(1);
    expect(sanitizeQuantity(NaN)).toBe(1);
    expect(sanitizeQuantity(3.7)).toBe(3);
    expect(sanitizeQuantity(10)).toBe(10);
  });
});

describe("Construcción de Adjuntos (buildAttachmentsPayload)", () => {
  it("descarta ficheros sin storageId y mapea tipo de archivo según MIME", () => {
    const files: PendingRequestFile[] = [
      {
        id: "1",
        file: new File(["image-bytes"], "averia.jpg", { type: "image/jpeg" }),
        storageId: "storage-1" as Id<"_storage">,
        uploading: false,
      },
      {
        id: "2",
        file: new File(["pdf-bytes"], "especificaciones.pdf", { type: "application/pdf" }),
        storageId: "storage-2" as Id<"_storage">,
        uploading: false,
      },
      {
        id: "3",
        file: new File(["txt-bytes"], "nota.txt", { type: "text/plain" }),
        uploading: true, // No tiene storageId aún
      },
    ];

    const payload = buildAttachmentsPayload(files);
    expect(payload).toEqual([
      { storageId: "storage-1", name: "averia.jpg", kind: "image" },
      { storageId: "storage-2", name: "especificaciones.pdf", kind: "document" },
    ]);
  });
});
