import { describe, expect, test } from "vitest";
import {
  buildProfileMetaChips,
  buildProfileStats,
  filterUserIncidents,
  filterUserRequests,
  getUserInitial,
} from "@/pages/dashboard/profile/helpers";

describe("profileHelpers", () => {
  describe("getUserInitial", () => {
    test("obtiene la inicial en mayúscula a partir del nombre", () => {
      expect(getUserInitial({ name: "ricardo", email: "ricardo@taller.es" })).toBe("R");
      expect(getUserInitial({ name: "  laura  " })).toBe("L");
    });

    test("obtiene la inicial a partir del email si no hay nombre", () => {
      expect(getUserInitial({ email: "admin@taller.es" })).toBe("A");
    });

    test("devuelve U por defecto si no hay nombre ni email", () => {
      expect(getUserInitial({})).toBe("U");
      expect(getUserInitial({ name: "" })).toBe("U");
    });
  });

  describe("buildProfileMetaChips", () => {
    test("filtra campos vacíos y retorna solo los definidos", () => {
      const chips = buildProfileMetaChips({
        position: "Mecánico jefe",
        location: undefined,
        phone: "600 123 456",
      });

      expect(chips).toHaveLength(2);
      expect(chips[0].text).toBe("Mecánico jefe");
      expect(chips[1].text).toBe("600 123 456");
    });

    test("retorna array vacío si el usuario no tiene datos de contacto", () => {
      const chips = buildProfileMetaChips({});
      expect(chips).toEqual([]);
    });
  });

  describe("filterUserIncidents", () => {
    const mockIncidents = [
      { id: "1", assigneeId: "user_a", workshopAssigneeId: undefined, updatedAt: 100 },
      { id: "2", assigneeId: "user_b", workshopAssigneeId: "user_a", updatedAt: 300 },
      { id: "3", assigneeId: "user_b", workshopAssigneeId: undefined, updatedAt: 200 },
    ];

    test("incluye incidencias donde el usuario es assigneeId o workshopAssigneeId ordenadas por updatedAt desc", () => {
      const result = filterUserIncidents(mockIncidents, "user_a");
      expect(result.map((i) => i.id)).toEqual(["2", "1"]);
    });

    test("retorna array vacío si el usuario no tiene ninguna asignada", () => {
      const result = filterUserIncidents(mockIncidents, "user_c");
      expect(result).toEqual([]);
    });
  });

  describe("filterUserRequests", () => {
    const mockRequests = [
      { id: "1", requesterId: "user_a", requesterName: "Carlos", createdAt: 100 },
      { id: "2", requesterId: undefined, requesterName: "Carlos", createdAt: 300 },
      { id: "3", requesterId: "user_b", requesterName: "Laura", createdAt: 200 },
    ];

    test("incluye peticiones por requesterId o por requesterName cuando requesterId es undefined ordenadas por createdAt desc", () => {
      const result = filterUserRequests(mockRequests, "user_a", "Carlos");
      expect(result.map((r) => r.id)).toEqual(["2", "1"]);
    });

    test("no empareja por nombre si requesterId pertenece a otro usuario", () => {
      const mock = [
        { id: "1", requesterId: "user_other", requesterName: "Carlos", createdAt: 100 },
      ];
      const result = filterUserRequests(mock, "user_a", "Carlos");
      expect(result).toHaveLength(0);
    });
  });

  describe("buildProfileStats", () => {
    test("genera las 4 tarjetas de estadísticas con etiquetas y textos apropiados", () => {
      const stats = buildProfileStats({
        openIncidentsCount: 2,
        closedIncidentsCount: 5,
        myRequestsCount: 1,
        pendingRequestsCount: 1,
        unreadCount: 3,
      });

      expect(stats).toHaveLength(4);
      expect(stats[0].value).toBe(2);
      expect(stats[0].hint).toBe("En curso o taller");
      expect(stats[1].value).toBe(5);
      expect(stats[2].value).toBe(1);
      expect(stats[2].hint).toBe("1 pendiente de revisión");
      expect(stats[3].value).toBe(3);
      expect(stats[3].hint).toBe("Pulsa la campana para revisarlos");
    });

    test("muestra hints alternativos cuando los contadores son 0", () => {
      const stats = buildProfileStats({
        openIncidentsCount: 0,
        closedIncidentsCount: 0,
        myRequestsCount: 0,
        pendingRequestsCount: 0,
        unreadCount: 0,
      });

      expect(stats[0].hint).toBe("Nada pendiente de ti");
      expect(stats[2].hint).toBe("Todavía no has pedido material");
      expect(stats[3].hint).toBe("Todo al día");
    });
  });
});
