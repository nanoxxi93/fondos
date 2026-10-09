import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateTea } from "../../src/domain/tea.js";
import { connectToDatabase } from "../../src/shared/db.js";
import { FundModel } from "../../src/shared/models/fund.model.js";
import {
  ErniQuotaModel,
  BbvaQuotaModel,
  TybaQuotaModel,
} from "../../src/shared/models/quota.model.js";

vi.mock("../../src/shared/db.js", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  isMongoReady: vi.fn().mockReturnValue(true),
}));

vi.mock("../../src/shared/models/fund.model.js", () => ({
  FundModel: {
    find: vi.fn(),
  },
}));

vi.mock("../../src/shared/models/quota.model.js", () => ({
  ErniQuotaModel: {
    find: vi.fn(),
  },
  BbvaQuotaModel: {
    find: vi.fn(),
  },
  TybaQuotaModel: {
    find: vi.fn(),
  },
}));

describe("Motor Analítico TEA (src/domain/tea.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createQueryMock(result: unknown) {
    return {
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(result),
      }),
      lean: vi.fn().mockResolvedValue(result),
    };
  }

  it("debe calcular la variación neta descontando comisión anual y normalizar valores relativos", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      {
        idFondo: "CASHSOL-PE",
        source: "bbva",
        name: "BBVA Cash Soles FMIV",
        currency: "PEN",
        risk: 1,
        fee: 0.5,
        serie: "-",
      },
    ];

    const mockBbvaQuotas = [
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-02T00:00:00.000Z"), value: 105 },
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-03T00:00:00.000Z"), value: 110 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockDbFunds),
    } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockBbvaQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ days: 30, now: fixedNow });

    expect(connectToDatabase).toHaveBeenCalledTimes(1);
    expect(result.labels).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(result.datasets).toHaveLength(1);

    const dataset = result.datasets[0];
    expect(dataset.label).toBe("Bbva Cash Soles Fmiv");
    expect(dataset.data).toEqual([0, 5, 10]); // ((105-100)/100)*100 = 5%
    // fee = 0.5, netValue = ((110 / 100 - 1) * (100 - 0.5)) = 0.10 * 99.5 = 9.95
    expect(dataset.meta.value).toBe(9.95);
    expect(dataset.meta.firstValue).toBe(100);
    expect(dataset.meta.lastValue).toBe(110);
    expect(dataset.meta.fee).toBe(0.5);
    expect(dataset.meta.currency).toBe("PEN");
    expect(dataset.meta.risk).toBe(1);
    expect(dataset.meta.idFondo).toBe("CASHSOL-PE");
    expect(dataset.meta.source).toBe("bbva");
    expect(dataset.hidden).toBe(true);
    expect(dataset.borderWidth).toBe(1);
  });

  it("debe alinear fechas desalineadas entre fuentes y rellenar con null", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "04", source: "erni", name: "IF_MEDIANO_PLAZO_SOLES", currency: "PEN", risk: 4, fee: 1.35 },
      { idFondo: "CASHSOL-PE", source: "bbva", name: "BBVA Cash Soles", currency: "PEN", risk: 1, fee: 0.5 },
    ];

    // ERNI cotiza día 1 y 2
    const mockErniQuotas = [
      { idFondo: "04", date: new Date("2026-10-01T00:00:00.000Z"), value: 200 },
      { idFondo: "04", date: new Date("2026-10-02T00:00:00.000Z"), value: 202 },
    ];

    // BBVA cotiza día 2 y 3
    const mockBbvaQuotas = [
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-02T00:00:00.000Z"), value: 100 },
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-03T00:00:00.000Z"), value: 102 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock(mockErniQuotas) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockBbvaQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ days: 30, now: fixedNow });

    expect(result.labels).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(result.datasets).toHaveLength(2);

    const erniDataset = result.datasets.find((ds) => ds.meta.source === "erni")!;
    const bbvaDataset = result.datasets.find((ds) => ds.meta.source === "bbva")!;

    // ERNI tiene cuotas en día 1 y 2, día 3 es null
    expect(erniDataset.data).toEqual([0, 1, null]);

    // BBVA tiene cuota en día 2 y 3, día 1 es null
    expect(bbvaDataset.data).toEqual([null, 0, 2]);
  });

  it("debe filtrar correctamente por moneda (currency)", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "CASHSOL-PE", source: "bbva", name: "BBVA Cash Soles", currency: "PEN", risk: 1, fee: 0.5 },
      { idFondo: "CASHDOL-PE", source: "bbva", name: "BBVA Cash Dólares", currency: "USD", risk: 1, fee: 0.45 },
    ];

    const mockQuotas = [
      { idFondo: "CASHSOL-PE", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
      { idFondo: "CASHDOL-PE", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const resultUSD = await calculateTea({ currency: "USD", now: fixedNow });
    expect(resultUSD.datasets).toHaveLength(1);
    expect(resultUSD.datasets[0].meta.currency).toBe("USD");

    const resultPEN = await calculateTea({ currency: "PEN", now: fixedNow });
    expect(resultPEN.datasets).toHaveLength(1);
    expect(resultPEN.datasets[0].meta.currency).toBe("PEN");
  });

  it("debe filtrar correctamente por riesgo máximo (risk)", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "F1", source: "bbva", name: "Fondo Conservador", currency: "PEN", risk: 1, fee: 0.5 },
      { idFondo: "F2", source: "bbva", name: "Fondo Moderado", currency: "PEN", risk: 4, fee: 1.0 },
      { idFondo: "F3", source: "bbva", name: "Fondo Agresivo", currency: "PEN", risk: 7, fee: 2.0 },
    ];

    const mockQuotas = [
      { idFondo: "F1", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
      { idFondo: "F2", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
      { idFondo: "F3", date: new Date("2026-10-01T00:00:00.000Z"), value: 100 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const resultRisk3 = await calculateTea({ risk: 3, now: fixedNow });
    expect(resultRisk3.datasets).toHaveLength(1);
    expect(resultRisk3.datasets[0].meta.idFondo).toBe("F1");

    const resultRisk5 = await calculateTea({ risk: 5, now: fixedNow });
    expect(resultRisk5.datasets).toHaveLength(2);
  });

  it("debe resolver metadatos desde catálogo estático de respaldo si no existen en BD", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    // BD vacía
    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as any);

    // Fondo BBVA "421" existe en BBVA_FUNDS_CATALOG
    const mockQuotas = [
      { idFondo: "421", date: new Date("2026-10-01T00:00:00.000Z"), value: 10 },
      { idFondo: "421", date: new Date("2026-10-02T00:00:00.000Z"), value: 11 },
    ];

    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ now: fixedNow });
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].label).toContain("Tesorería Soles");
    expect(result.datasets[0].meta.idFondo).toBe("421");
    expect(result.datasets[0].meta.fee).toBe(0.4);
  });

  it("debe manejar fondos con una sola observación (0% de variación sin NaN)", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "SOLO1", source: "bbva", name: "Fondo Solo 1", currency: "PEN", risk: 1, fee: 1.0 },
    ];
    const mockQuotas = [
      { idFondo: "SOLO1", date: new Date("2026-10-01T00:00:00.000Z"), value: 50 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ now: fixedNow });
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].data).toEqual([0]);
    expect(result.datasets[0].meta.value).toBe(0);
  });

  it("debe descartar fondos con cuotas anómalas de valor 0", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "ZERO", source: "bbva", name: "Fondo Zero", currency: "PEN", risk: 1, fee: 1.0 },
    ];
    const mockQuotas = [
      { idFondo: "ZERO", date: new Date("2026-10-01T00:00:00.000Z"), value: 0 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ now: fixedNow });
    expect(result.datasets).toHaveLength(0);
  });

  it("debe ordenar los datasets alfabéticamente y asignar meta.index correlativo", async () => {
    const fixedNow = new Date("2026-10-09T18:00:00.000Z");

    const mockDbFunds = [
      { idFondo: "Z", source: "bbva", name: "Zeta Fondo", currency: "PEN", risk: 1, fee: 1.0 },
      { idFondo: "A", source: "bbva", name: "Alfa Fondo", currency: "PEN", risk: 1, fee: 1.0 },
      { idFondo: "M", source: "bbva", name: "Medio Fondo", currency: "PEN", risk: 1, fee: 1.0 },
    ];
    const mockQuotas = [
      { idFondo: "Z", date: new Date("2026-10-01T00:00:00.000Z"), value: 10 },
      { idFondo: "A", date: new Date("2026-10-01T00:00:00.000Z"), value: 10 },
      { idFondo: "M", date: new Date("2026-10-01T00:00:00.000Z"), value: 10 },
    ];

    vi.mocked(FundModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue(mockDbFunds) } as any);
    vi.mocked(ErniQuotaModel.find).mockReturnValue(createQueryMock([]) as any);
    vi.mocked(BbvaQuotaModel.find).mockReturnValue(createQueryMock(mockQuotas) as any);
    vi.mocked(TybaQuotaModel.find).mockReturnValue(createQueryMock([]) as any);

    const result = await calculateTea({ now: fixedNow });
    expect(result.datasets).toHaveLength(3);
    expect(result.datasets[0].label).toBe("Alfa Fondo");
    expect(result.datasets[0].meta.index).toBe(0);
    expect(result.datasets[1].label).toBe("Medio Fondo");
    expect(result.datasets[1].meta.index).toBe(1);
    expect(result.datasets[2].label).toBe("Zeta Fondo");
    expect(result.datasets[2].meta.index).toBe(2);
  });
});
