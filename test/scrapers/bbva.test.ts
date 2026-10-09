import { describe, it, expect, vi, beforeEach } from "vitest";
import { BBVA_FUNDS_CATALOG } from "../../src/scrapers/bbva/catalog.js";
import {
  normalizeBbvaQuotas,
  toBbvaFundMetadata,
  calculateBbvaDateRange,
} from "../../src/scrapers/bbva/parser.js";
import {
  getBbvaTsec,
  invalidateBbvaTsec,
  fetchFundDetail,
  fetchPastReturns,
} from "../../src/scrapers/bbva/client.js";
import type {
  BbvaWeightedAssetValue,
  BbvaFundDetailData,
} from "../../src/scrapers/bbva/types.js";

describe("BBVA Scraper - Catálogo y Cobertura de Fondos", () => {
  it("debe contener exactamente los 21 fondos mutuos verificados", () => {
    const keys = Object.keys(BBVA_FUNDS_CATALOG);
    expect(keys.length).toBe(21);
  });

  it("debe incluir los 2 nuevos fondos incorporados con sus metadatos correctos", () => {
    const fondo421 = BBVA_FUNDS_CATALOG["421"];
    expect(fondo421).toBeDefined();
    expect(fondo421.currency).toBe("PEN");
    expect(fondo421.risk).toBe(1);
    expect(fondo421.fee).toBe(0.4);

    const fondoBBVAEM = BBVA_FUNDS_CATALOG["BBVAEM"];
    expect(fondoBBVAEM).toBeDefined();
    expect(fondoBBVAEM.currency).toBe("USD");
    expect(fondoBBVAEM.risk).toBe(5);
    expect(fondoBBVAEM.fee).toBe(0.85);
  });

  it("todos los fondos del catálogo deben tener monedas válidas (PEN o USD) y riesgos entre 1 y 7", () => {
    for (const fund of Object.values(BBVA_FUNDS_CATALOG)) {
      expect(["PEN", "USD"]).toContain(fund.currency);
      expect(fund.risk).toBeGreaterThanOrEqual(1);
      expect(fund.risk).toBeLessThanOrEqual(7);
      expect(fund.fee).toBeGreaterThan(0);
    }
  });
});

describe("BBVA Scraper - Parser y Normalización", () => {
  const mockWeightedValues: BbvaWeightedAssetValue[] = [
    {
      valueDate: "2026-10-06",
      valueAmount: { amount: 174.946443, currency: "PEN" },
    },
    {
      valueDate: "2026-10-05",
      valueAmount: { amount: 174.912345, currency: "PEN" },
    },
  ];

  it("normalizeBbvaQuotas mapea registros al modelo canónico con medianoche UTC", () => {
    const normalized = normalizeBbvaQuotas("CASHSOL-PE", mockWeightedValues);
    expect(normalized).toHaveLength(2);
    expect(normalized[0].idFondo).toBe("CASHSOL-PE");
    expect(normalized[0].idSerie).toBeNull();
    expect(normalized[0].value).toBe(174.946443);
    expect(normalized[0].date.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  it("toBbvaFundMetadata fusiona la información del catálogo con el detalle enriquecido de la API", () => {
    const catalogItem = BBVA_FUNDS_CATALOG["CASHSOL-PE"];
    const mockDetail: BbvaFundDetailData = {
      id: "CASHSOL-PE",
      name: "BBVA Cash Soles FMIV (Enriquecido)",
      fundCurrency: { id: "PEN" },
      fundGroup: { riskLevel: { id: "1" } },
      fees: {
        itemizeFees: [
          {
            id: "MANAGEMENT",
            itemizeFeeUnit: { percentage: 0.5 },
          },
        ],
      },
    };

    const metadata = toBbvaFundMetadata(catalogItem, mockDetail);
    expect(metadata.idFondo).toBe("CASHSOL-PE");
    expect(metadata.source).toBe("bbva");
    expect(metadata.name).toBe("BBVA Cash Soles FMIV (Enriquecido)");
    expect(metadata.currency).toBe("PEN");
    expect(metadata.risk).toBe(1);
    expect(metadata.fee).toBe(0.5);
    expect(metadata.serie).toBe("-");
  });

  it("toBbvaFundMetadata utiliza valores de fallback si la API no retorna detalle de tarifas o riesgo", () => {
    const catalogItem = BBVA_FUNDS_CATALOG["421"];
    const metadata = toBbvaFundMetadata(catalogItem);

    expect(metadata.idFondo).toBe("421");
    expect(metadata.name).toBe("BBVA Tesorería Soles FMIV");
    expect(metadata.fee).toBe(0.4);
    expect(metadata.risk).toBe(1);
    expect(metadata.currency).toBe("PEN");
  });

  it("calculateBbvaDateRange calcula correctamente los rangos por defecto y personalizados", () => {
    const custom = calculateBbvaDateRange(30, "2026-01-01", "2026-06-01");
    expect(custom.fromDate).toBe("2026-01-01");
    expect(custom.toDate).toBe("2026-06-01");

    const defaultRange = calculateBbvaDateRange(30);
    expect(defaultRange.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaultRange.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("BBVA Scraper - Cliente HTTP y Autenticación TSEC", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateBbvaTsec();
  });

  it("getBbvaTsec adquiere el token desde el header de respuesta y lo cachea", async () => {
    const fakeToken = "fake-tsec-token-123456";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h.toLowerCase() === "tsec" ? fakeToken : null),
      },
      json: async () => ({ authenticationState: "OK" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token1 = await getBbvaTsec();
    expect(token1).toBe(fakeToken);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Segunda llamada debe usar la caché en memoria y no invocar fetch de nuevo
    const token2 = await getBbvaTsec();
    expect(token2).toBe(fakeToken);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getBbvaTsec lanza un error descriptivo si la API rechaza las credenciales", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBbvaTsec()).rejects.toThrow("HTTP 401 Unauthorized");
  });

  it("fetchFundDetail consulta y valida la estructura con TypeBox", async () => {
    const fakeToken = "fake-tsec-token";
    const mockDetailResponse = {
      data: {
        id: "CASHSOL-PE",
        name: "BBVA Cash Soles FMIV",
        fundCurrency: { id: "PEN" },
        fundGroup: { riskLevel: { id: "1" } },
      },
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("grantingTickets")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => fakeToken },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => mockDetailResponse,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchFundDetail("CASHSOL-PE");
    expect(detail.data.id).toBe("CASHSOL-PE");
    expect(detail.data.name).toBe("BBVA Cash Soles FMIV");
  });

  it("fetchPastReturns consulta y valida las cuotas históricas", async () => {
    const fakeToken = "fake-tsec-token";
    const mockReturnsResponse = {
      data: {
        weightedAverageAssetValues: [
          {
            valueDate: "2026-10-06",
            valueAmount: { amount: 174.94, currency: "PEN" },
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("grantingTickets")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => fakeToken },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        headers: { get: () => "application/json" },
        json: async () => mockReturnsResponse,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchPastReturns({
      idFondo: "CASHSOL-PE",
      currency: "PEN",
      fromDate: "2026-09-01",
      toDate: "2026-10-06",
    });

    expect(res.data?.weightedAverageAssetValues).toHaveLength(1);
    expect(res.data?.weightedAverageAssetValues?.[0].valueAmount.amount).toBe(174.94);
  });

  it("fetchPastReturns reintenta automáticamente renovando TSEC ante error HTTP 401", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("grantingTickets")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => `token-attempt-${++callCount}` },
        });
      }
      if (callCount === 1) {
        // Primera llamada con token viejo retorna 401
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        });
      }
      // Reintento con token renovado retorna 201 éxito
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          data: { weightedAverageAssetValues: [] },
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchPastReturns({
      idFondo: "CASHSOL-PE",
      currency: "PEN",
      fromDate: "2026-09-01",
      toDate: "2026-10-06",
    });

    expect(res.data?.weightedAverageAssetValues).toEqual([]);
    expect(callCount).toBe(2); // Se llamó a grantingTickets dos veces
  });
});
