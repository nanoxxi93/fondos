import { describe, it, expect } from "vitest";
import {
  pMap,
  toUtcMidnight,
  toIsoDateString,
  capitalize,
  normalizeFundName,
  colorFromKey,
  escapeHtml,
  toSafeJson,
  parseDays,
  parseCurrency,
  parseRisk,
} from "../../src/shared/utils.js";

describe("Shared Utils (src/shared/utils.ts)", () => {
  describe("pMap", () => {
    it("debe procesar elementos concurrentemente respetando el orden", async () => {
      const items = [10, 20, 30, 40, 50];
      const results = await pMap(
        items,
        async (item) => {
          return item * 2;
        },
        2
      );
      expect(results).toEqual([20, 40, 60, 80, 100]);
    });

    it("debe manejar un array vacío inmediatamente", async () => {
      const results = await pMap([], async (x) => x, 4);
      expect(results).toEqual([]);
    });
  });

  describe("toUtcMidnight y toIsoDateString", () => {
    it("debe normalizar fechas a medianoche UTC", () => {
      const date = toUtcMidnight("2026-10-09T18:30:00-05:00");
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it("debe arrojar error si la fecha es inválida", () => {
      expect(() => toUtcMidnight("fecha-no-valida")).toThrow("Fecha inválida");
    });

    it("debe formatear a YYYY-MM-DD", () => {
      const formatted = toIsoDateString(new Date("2026-10-09T15:00:00Z"));
      expect(formatted).toBe("2026-10-09");
    });
  });

  describe("capitalize y colorFromKey", () => {
    it("debe capitalizar palabras en una cadena", () => {
      expect(capitalize("fondo mutuo acciones")).toBe("Fondo Mutuo Acciones");
    });

    it("debe generar esquemas de color determinísticos", () => {
      const col1 = colorFromKey("bbva:fondo-1");
      const col2 = colorFromKey("bbva:fondo-1");
      expect(col1).toEqual(col2);
      expect(col1.backgroundColor).toContain("hsla(");
      expect(col1.borderColor).toContain("hsla(");
    });
  });

  describe("normalizeFundName", () => {
    it("debe remover el prefijo 'Fondo de Fondos' o 'Fondo De Fondos' en fondos BBVA", () => {
      expect(
        normalizeFundName("Fondo de Fondos BBVA Acciones Globales Millennials FMIV", "bbva")
      ).toBe("BBVA Acciones Globales Millennials FMIV");
      expect(
        normalizeFundName("Fondo De Fondos Bbva Conservador Global Dólares Fmiv", "bbva")
      ).toBe("Bbva Conservador Global Dólares Fmiv");
      expect(
        normalizeFundName("Fondo de Fondos BBVA Deuda High Yield  FMIV", "bbva")
      ).toBe("BBVA Deuda High Yield FMIV");
    });

    it("debe transformar 'Fondo de Fondos Acciones Globales Real Estate FMIV' directamente a BBVA Acciones...", () => {
      expect(
        normalizeFundName("Fondo de Fondos Acciones Globales Real Estate FMIV", "bbva")
      ).toBe("BBVA Acciones Globales Real Estate FMIV");
      expect(
        normalizeFundName("Fondo De Fondos Acciones Globales Real Estate Fmiv")
      ).toBe("BBVA Acciones Globales Real Estate Fmiv");
      expect(
        capitalize(normalizeFundName("Fondo De Fondos Acciones Globales Real Estate Fmiv"))
      ).toBe("Bbva Acciones Globales Real Estate Fmiv");
    });

    it("debe remover el prefijo 'FDF' en fondos ERNI dejando directamente 'IF ...'", () => {
      expect(normalizeFundName("FDF IF 49 Rendimiento Global 360 FMIV", "erni")).toBe(
        "IF 49 Rendimiento Global 360 FMIV"
      );
      expect(normalizeFundName("FDF IF Enfoque Global FMIV", "erni")).toBe(
        "IF Enfoque Global FMIV"
      );
      expect(normalizeFundName("FDF IF Inversión EE.UU. FMIV", "erni")).toBe(
        "IF Inversión EE.UU. FMIV"
      );
      expect(normalizeFundName("Fdf If Inversion India Fmiv", "erni")).toBe(
        "If Inversion India Fmiv"
      );
      expect(
        capitalize(normalizeFundName("FDF IF 49 Rendimiento Global 360 FMIV", "erni"))
      ).toBe("If 49 Rendimiento Global 360 Fmiv");
    });

    it("debe preservar nombres limpios sin prefijos redundantes", () => {
      expect(normalizeFundName("BBVA Cash Soles FMIV", "bbva")).toBe("BBVA Cash Soles FMIV");
      expect(normalizeFundName("IF Oportunidad Soles FMIV", "erni")).toBe("IF Oportunidad Soles FMIV");
      expect(normalizeFundName("CC Acciones China", "tyba")).toBe("CC Acciones China");
      expect(normalizeFundName("")).toBe("");
    });
  });

  describe("escapeHtml y toSafeJson", () => {
    it("debe escapar caracteres HTML reservados", () => {
      expect(escapeHtml('<div class="test">& \'hola\'</div>')).toBe(
        "&lt;div class=&quot;test&quot;&gt;&amp; &#39;hola&#39;&lt;/div&gt;"
      );
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
    });

    it("debe sanitizar JSON escapando caracteres <", () => {
      const json = toSafeJson({ script: "<script>alert(1)</script>" });
      expect(json).not.toContain("<script>");
      expect(json).toContain("\\u003cscript>");
    });
  });

  describe("parseDays, parseCurrency y parseRisk", () => {
    it("debe parsear días acotados entre 1 y 3650", () => {
      expect(parseDays("45")).toBe(45);
      expect(parseDays("0")).toBe(1);
      expect(parseDays("5000")).toBe(3650);
      expect(parseDays("invalido", 30)).toBe(30);
      expect(parseDays(undefined, 30)).toBe(30);
    });

    it("debe parsear monedas válidas y descartar inválidas", () => {
      expect(parseCurrency("pen")).toBe("PEN");
      expect(parseCurrency("USD")).toBe("USD");
      expect(parseCurrency("EUR")).toBeUndefined();
      expect(parseCurrency("")).toBeUndefined();
      expect(parseCurrency(null)).toBeUndefined();
    });

    it("debe parsear riesgo como número entero", () => {
      expect(parseRisk("4")).toBe(4);
      expect(parseRisk("")).toBeUndefined();
      expect(parseRisk("invalido")).toBeUndefined();
      expect(parseRisk(null)).toBeUndefined();
    });
  });
});
