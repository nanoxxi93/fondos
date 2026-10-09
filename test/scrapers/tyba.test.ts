import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TYBA_FUNDS_CATALOG } from '../../src/scrapers/tyba/catalog.js';
import {
  sanitizeAuthToken,
  resolveAppProof,
  resolveRefreshToken,
  mapRiskLevel,
  mapPortfolioMetadata,
  normalizeHistoricQuotas,
} from '../../src/scrapers/tyba/parser.js';
import {
  generateAppProof,
  TYBA_PUBLIC_KEY_PEM,
  DEFAULT_TYBA_SOURCE_APP,
  DEFAULT_TYBA_VERSION,
} from '../../src/scrapers/tyba/crypto.js';
import type { TybaHistoricPoint, TybaPortfolioItem } from '../../src/scrapers/tyba/types.js';

describe('Tyba Scraper - Generación Criptográfica de x-app-proof', () => {
  it('debe contener la clave pública RSA de Tyba con formato PEM válido', () => {
    expect(TYBA_PUBLIC_KEY_PEM).toContain('-----BEGIN PUBLIC KEY-----');
    expect(TYBA_PUBLIC_KEY_PEM).toContain('-----END PUBLIC KEY-----');
    expect(DEFAULT_TYBA_SOURCE_APP).toBe('TYBA_WEB_PE');
    expect(DEFAULT_TYBA_VERSION).toBe('5.65.3');
  });

  it('debe generar una firma criptográfica Base64 de 684 caracteres para RSA-4096', () => {
    const proof = generateAppProof('GET', '/robo-advisor/v2/portfolios/sqi');
    expect(proof).toBeTypeOf('string');
    expect(proof.length).toBe(684);
    expect(proof.endsWith('=')).toBe(true);
    // Verificar que sea Base64 válido
    expect(() => Buffer.from(proof, 'base64')).not.toThrow();
    expect(Buffer.from(proof, 'base64').length).toBe(512); // 4096 bits = 512 bytes
  });

  it('debe generar firmas distintas en invocaciones sucesivas gracias al padding probabilístico OAEP', () => {
    const proof1 = generateAppProof('GET', '/robo-advisor/v2/portfolios/sqi', {
      reqUTCDate: '2026-10-09T12:00:00.000Z',
    });
    const proof2 = generateAppProof('GET', '/robo-advisor/v2/portfolios/sqi', {
      reqUTCDate: '2026-10-09T12:00:00.000Z',
    });
    expect(proof1).not.toBe(proof2);
    expect(proof1.length).toBe(684);
    expect(proof2.length).toBe(684);
  });

  it('debe sanitizar la ruta eliminando query parameters y asegurando barra inicial', () => {
    const proofWithQuery = generateAppProof(
      'GET',
      'robo-advisor/v2/portfolios/sqi?product=PARKER&orderByProfitability=true'
    );
    expect(proofWithQuery).toBeTypeOf('string');
    expect(proofWithQuery.length).toBe(684);
  });

  it('debe aceptar parámetros opcionales de versión, aplicación y fecha UTC', () => {
    const proofCustom = generateAppProof('POST', '/api-master/sample', {
      sourceApp: 'CUSTOM_APP',
      versionNumber: '1.0.0',
      reqUTCDate: '2026-01-01T00:00:00.000Z',
    });
    expect(proofCustom).toBeTypeOf('string');
    expect(proofCustom.length).toBe(684);
  });
});

describe('Tyba Scraper - Catálogo Canónico Base', () => {
  it('debe contener exactamente los 30 fondos de Credicorp Capital provenientes del legacy', () => {
    const keys = Object.keys(TYBA_FUNDS_CATALOG);
    expect(keys.length).toBe(30);
  });

  it('todos los fondos deben tener monedas válidas (PEN o USD) y riesgos entre 1 y 7', () => {
    for (const fund of Object.values(TYBA_FUNDS_CATALOG)) {
      expect(['PEN', 'USD']).toContain(fund.currency);
      expect(fund.risk).toBeGreaterThanOrEqual(1);
      expect(fund.risk).toBeLessThanOrEqual(7);
      expect(fund.fee).toBeGreaterThan(0);
      expect(fund.name.length).toBeGreaterThan(3);
    }
  });

  it('debe verificar fondos clave del catálogo (Renta Futura III, Acciones China, Liquidez Soles)', () => {
    const china = TYBA_FUNDS_CATALOG['4f28ebf4-6d3c-53f0-9a48-8e415e83f323'];
    expect(china).toBeDefined();
    expect(china.name).toBe('CC Acciones China');
    expect(china.currency).toBe('USD');
    expect(china.risk).toBe(7);
    expect(china.fee).toBe(0.010252);

    const rf3 = TYBA_FUNDS_CATALOG['8c2f0120-5156-53ca-b9e7-7fb7059a3a6b'];
    expect(rf3).toBeDefined();
    expect(rf3.name).toBe('CC Renta Futura III');
    expect(rf3.currency).toBe('USD');
    expect(rf3.risk).toBe(7);

    const liqSoles = TYBA_FUNDS_CATALOG['bd2445cd-a8b1-5d84-9e32-5838e19d78e1'];
    expect(liqSoles).toBeDefined();
    expect(liqSoles.name).toBe('CC Liquidez Soles');
    expect(liqSoles.currency).toBe('PEN');
    expect(liqSoles.risk).toBe(1);
  });
});

describe('Tyba Scraper - Parser y Normalización Pura', () => {
  describe('sanitizeAuthToken', () => {
    it('debe remover el prefijo Bearer case-insensitive y espacios', () => {
      expect(sanitizeAuthToken('Bearer eyJhbGciOiJSUzI1NiIs...')).toBe('eyJhbGciOiJSUzI1NiIs...');
      expect(sanitizeAuthToken('bearer   eyJhbGci...  ')).toBe('eyJhbGci...');
      expect(sanitizeAuthToken('BEARER eyJhbGci...')).toBe('eyJhbGci...');
    });

    it('debe mantener el token intacto si no contiene Bearer', () => {
      expect(sanitizeAuthToken('eyJhbGciOiJSUzI1NiIs...')).toBe('eyJhbGciOiJSUzI1NiIs...');
    });

    it('debe retornar string vacío si el input es undefined o vacío', () => {
      expect(sanitizeAuthToken(undefined)).toBe('');
      expect(sanitizeAuthToken('')).toBe('');
      expect(sanitizeAuthToken('   ')).toBe('');
    });
  });

  describe('resolveAppProof', () => {
    it('debe extraer el valor de xAppProof', () => {
      expect(resolveAppProof({ xAppProof: 'lCBQiuW5WCZ/...' })).toBe('lCBQiuW5WCZ/...');
    });

    it('debe extraer el valor de x-app-proof si xAppProof no existe', () => {
      expect(resolveAppProof({ 'x-app-proof': 'UuTl3svsGKMK...' })).toBe('UuTl3svsGKMK...');
    });

    it('debe preferir xAppProof sobre x-app-proof si ambos están presentes', () => {
      expect(resolveAppProof({ xAppProof: 'proof1', 'x-app-proof': 'proof2' })).toBe('proof1');
    });

    it('debe retornar vacío si no hay objeto de evento o no contiene la clave', () => {
      expect(resolveAppProof(undefined)).toBe('');
      expect(resolveAppProof({})).toBe('');
    });
  });

  describe('resolveRefreshToken', () => {
    it('debe extraer el valor de refreshToken', () => {
      expect(resolveRefreshToken({ refreshToken: 'my-refresh-token-123' })).toBe('my-refresh-token-123');
    });

    it('debe extraer el valor de refresh-token si refreshToken no existe', () => {
      expect(resolveRefreshToken({ 'refresh-token': 'kebab-refresh-token' })).toBe('kebab-refresh-token');
    });

    it('debe preferir refreshToken sobre refresh-token', () => {
      expect(resolveRefreshToken({ refreshToken: 'ref1', 'refresh-token': 'ref2' })).toBe('ref1');
    });

    it('debe retornar undefined si no hay evento o viene en blanco', () => {
      expect(resolveRefreshToken(undefined)).toBeUndefined();
      expect(resolveRefreshToken({})).toBeUndefined();
      expect(resolveRefreshToken({ refreshToken: '   ' })).toBeUndefined();
    });
  });

  describe('mapRiskLevel', () => {
    it('debe mapear correctamente los niveles de riesgo textuales a escala 1..7', () => {
      expect(mapRiskLevel('LOW')).toBe(1);
      expect(mapRiskLevel(undefined, 'Bajo')).toBe(1);
      expect(mapRiskLevel('MEDIUM')).toBe(4);
      expect(mapRiskLevel(undefined, 'Medio')).toBe(4);
      expect(mapRiskLevel('HIGH')).toBe(7);
      expect(mapRiskLevel(undefined, 'Alto')).toBe(7);
    });

    it('debe usar el fallback si el valor es desconocido o no viene', () => {
      expect(mapRiskLevel(undefined, undefined, 4)).toBe(4);
      expect(mapRiskLevel('DESCONOCIDO', undefined, 2)).toBe(2);
    });
  });

  describe('mapPortfolioMetadata', () => {
    it('debe mapear un item de portafolio al formato IFund de la colección funds', () => {
      const item: TybaPortfolioItem = {
        id: '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b',
        name: 'CC Renta Futura III',
        currency: 'USD',
        risk: 'HIGH',
        riskLevel: 'Alto',
        comission: 0.016,
      };

      const fund = mapPortfolioMetadata(item);
      expect(fund.idFondo).toBe('8c2f0120-5156-53ca-b9e7-7fb7059a3a6b');
      expect(fund.source).toBe('tyba');
      expect(fund.name).toBe('CC Renta Futura III');
      expect(fund.currency).toBe('USD');
      expect(fund.risk).toBe(7);
      expect(fund.fee).toBe(0.016);
      expect(fund.serie).toBe('-');
      expect(fund.updatedAt).toBeInstanceOf(Date);
    });

    it('debe usar fallback del catálogo estático si faltan campos en la API', () => {
      const item: TybaPortfolioItem = {
        id: '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b',
        name: '',
        currency: 'USD',
      };
      const fallback = TYBA_FUNDS_CATALOG['8c2f0120-5156-53ca-b9e7-7fb7059a3a6b'];

      const fund = mapPortfolioMetadata(item, fallback);
      expect(fund.name).toBe('CC Renta Futura III');
      expect(fund.risk).toBe(7);
      expect(fund.fee).toBe(0.016);
    });
  });

  describe('normalizeHistoricQuotas', () => {
    const mockPoints: TybaHistoricPoint[] = [
      { interval: '2021-10-09', value: 118.5938995 },
      { interval: '2021-10-15', value: 118.6129558 },
      { interval: '2021-10-21', value: 118.5078513 },
      { interval: '2021-10-27', value: 118.5250761 },
      { interval: '2021-11-02', value: 118.452689 },
    ];

    it('debe recortar las últimas N observaciones usando .slice(-days) con días por defecto', () => {
      const result = normalizeHistoricQuotas('test-id', mockPoints, 2);
      expect(result.length).toBe(2);
      expect(result[0].value).toBe(118.5250761);
      expect(result[1].value).toBe(118.452689);
      expect(result[0].idSerie).toBeNull();
      expect(result[0].idFondo).toBe('test-id');
    });

    it('debe truncar las fechas a medianoche UTC (00:00:00.000Z)', () => {
      const result = normalizeHistoricQuotas('test-id', mockPoints, 1);
      expect(result.length).toBe(1);
      expect(result[0].date.toISOString()).toBe('2021-11-02T00:00:00.000Z');
    });

    it('debe retornar todos los puntos si all === true ignorando el límite de días', () => {
      const result = normalizeHistoricQuotas('test-id', mockPoints, 2, true);
      expect(result.length).toBe(5);
      expect(result[0].date.toISOString()).toBe('2021-10-09T00:00:00.000Z');
    });

    it('debe retornar arreglo vacío si los puntos son nulos o vacíos', () => {
      expect(normalizeHistoricQuotas('test-id', [])).toEqual([]);
      expect(normalizeHistoricQuotas('test-id', null as any)).toEqual([]);
    });
  });
});

describe('Tyba Scraper - Cliente HTTP', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildTybaHeaders', () => {
    it('debe autogenerar x-app-proof con criptografía RSA cuando no se especifica appProof', async () => {
      const { buildTybaHeaders } = await import('../../src/scrapers/tyba/client.js');
      const headers = buildTybaHeaders({
        authorization: 'Bearer valid-jwt-token',
        method: 'GET',
        route: '/robo-advisor/v2/portfolios/sqi',
      }) as Record<string, string>;

      expect(headers['authorization']).toBe('valid-jwt-token');
      expect(headers['accept']).toBe('application/json');
      expect(headers['content-type']).toBe('application/json');
      expect(headers['x-app-proof']).toBeTypeOf('string');
      expect(headers['x-app-proof'].length).toBe(684);
    });

    it('debe utilizar el appProof provisto manualmente si está presente', async () => {
      const { buildTybaHeaders } = await import('../../src/scrapers/tyba/client.js');
      const headers = buildTybaHeaders({
        authorization: 'valid-jwt-token',
        appProof: 'my-manual-custom-proof',
      }) as Record<string, string>;

      expect(headers['x-app-proof']).toBe('my-manual-custom-proof');
    });
  });

  describe('fetchPortfoliosCatalog', () => {
    it('debe autogenerar x-app-proof al consultar el catálogo sin appProof explícito', async () => {
      const mockResponse = {
        recommended: [],
        notRecommended: [],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchPortfoliosCatalog } = await import('../../src/scrapers/tyba/client.js');
      await fetchPortfoliosCatalog('Bearer my-jwt-token');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['authorization']).toBe('my-jwt-token');
      expect(headers['x-app-proof']).toBeTypeOf('string');
      expect(headers['x-app-proof'].length).toBe(684);
    });

    it('debe consultar el catálogo y retornar los arreglos de portafolios validados', async () => {
      const mockResponse = {
        recommended: [
          {
            id: '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b',
            name: 'CC Renta Futura III',
            currency: 'USD',
            assetType: 'MIXED',
            comission: 0.016,
            risk: 'HIGH',
            riskLevel: 'Alto',
          },
        ],
        notRecommended: [
          {
            id: 'c287fa0c-aea7-57c2-b137-e4058899dd5a',
            name: 'Portafolio 8 Dólares',
            currency: 'USD',
            assetType: 'MIXED',
            comission: 0.01675,
            risk: 'HIGH',
            riskLevel: 'Alto',
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchPortfoliosCatalog } = await import('../../src/scrapers/tyba/client.js');
      const result = await fetchPortfoliosCatalog('Bearer my-jwt-token', 'my-app-proof');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers['authorization']).toBe('my-jwt-token');
      expect(headers['x-app-proof']).toBe('my-app-proof');
      expect(result.recommended.length).toBe(1);
      expect(result.notRecommended.length).toBe(1);
    });

    it('debe lanzar error con status si la API responde con código 4xx o 5xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      } as Response);

      const { fetchPortfoliosCatalog } = await import('../../src/scrapers/tyba/client.js');
      await expect(
        fetchPortfoliosCatalog('bad-token', 'proof')
      ).rejects.toThrow('Fallo en catálogo de Tyba HTTP 401 Unauthorized');
    });

    it('debe lanzar error de contrato si la estructura no contiene recommended o notRecommended', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ datosIncompletos: true }),
      } as Response);

      const { fetchPortfoliosCatalog } = await import('../../src/scrapers/tyba/client.js');
      await expect(
        fetchPortfoliosCatalog('valid-token', 'proof')
      ).rejects.toThrow('no cumple el contrato esperado');
    });
  });

  describe('fetchHistoricPerformance', () => {
    it('debe autogenerar x-app-proof al consultar el histórico de un fondo sin appProof explícito', async () => {
      const mockResponse = {
        graphData: [{ interval: '2026-10-01', value: 100 }],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchHistoricPerformance } = await import('../../src/scrapers/tyba/client.js');
      await fetchHistoricPerformance('fondo-456', 'Bearer jwt');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['authorization']).toBe('jwt');
      expect(headers['x-app-proof']).toBeTypeOf('string');
      expect(headers['x-app-proof'].length).toBe(684);
    });

    it('debe consultar el histórico de un fondo y retornar graphData validado', async () => {
      const mockResponse = {
        graphData: [
          { interval: '2026-10-01', value: 128.0424 },
          { interval: '2026-10-07', value: 127.979298 },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { fetchHistoricPerformance } = await import('../../src/scrapers/tyba/client.js');
      const result = await fetchHistoricPerformance('fondo-123', 'Bearer jwt', 'proof');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.graphData.length).toBe(2);
      expect(result.graphData[0].value).toBe(128.0424);
    });

    it('debe lanzar error con status ante respuesta no exitosa', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Portfolio not found',
      } as Response);

      const { fetchHistoricPerformance } = await import('../../src/scrapers/tyba/client.js');
      await expect(
        fetchHistoricPerformance('fondo-inexistente', 'jwt', 'proof')
      ).rejects.toThrow('Fallo en histórico de Tyba para fondo fondo-inexistente HTTP 404');
    });
  });

  describe('refreshAuthToken', () => {
    it('debe solicitar renovación de token y retornar nuevo token JWT saneado', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'Bearer newly-refreshed-jwt-token' }),
      } as Response);

      const { refreshAuthToken } = await import('../../src/scrapers/tyba/client.js');
      const newToken = await refreshAuthToken('valid-refresh-token');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs[0]).toContain('/api-master/auth/refresh-token');
      expect(JSON.parse(callArgs[1]?.body as string)).toEqual({ refreshToken: 'valid-refresh-token' });
      expect(newToken).toBe('newly-refreshed-jwt-token');
    });

    it('debe lanzar error con status si la API de refresh responde con error HTTP', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Refresh token expired',
      } as Response);

      const { refreshAuthToken } = await import('../../src/scrapers/tyba/client.js');
      await expect(refreshAuthToken('expired-refresh-token')).rejects.toThrow(
        'Fallo al refrescar token de Tyba HTTP 401 Unauthorized'
      );
    });

    it('debe lanzar error si la respuesta no contiene un token válido según TypeBox', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpectedField: 123 }),
      } as Response);

      const { refreshAuthToken } = await import('../../src/scrapers/tyba/client.js');
      await expect(refreshAuthToken('valid-refresh-token')).rejects.toThrow(
        'Respuesta de refresh-token de Tyba no cumple el contrato esperado'
      );
    });
  });
});

describe('Tyba Scraper - Lambda Handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('debe arrojar error 400 si falta authorization o es inválido en el evento', async () => {
    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    await expect(handler()).rejects.toThrow('Error de validación 400');
    await expect(handler({ authorization: '' })).rejects.toThrow('Error de validación 400');
    await expect(
      handler({ authorization: 'demasiado-corto' })
    ).rejects.toThrow('Error de validación 400');
  });

  it('debe arrojar error 502 Bad Gateway si la consulta de catálogo falla', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Tyba catalog error',
    } as Response);

    // Mock DB y config
    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValueOnce({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValueOnce({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    await expect(
      handler({
        authorization: 'valid-jwt-token-long-enough-123',
        xAppProof: 'valid-proof-long-enough-123',
      })
    ).rejects.toThrow('HTTP 502 Bad Gateway');
  });

  it('debe ejecutar el ciclo completo sincronizando catálogo y cuotas con statusCode 200', async () => {
    const mockCatalog = {
      recommended: [
        {
          id: '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b',
          name: 'CC Renta Futura III',
          currency: 'USD',
          assetType: 'MIXED',
          comission: 0.016,
          risk: 'HIGH',
          riskLevel: 'Alto',
        },
      ],
      notRecommended: [],
    };

    const mockHistory = {
      graphData: [
        { interval: '2026-10-06', value: 130.5 },
        { interval: '2026-10-07', value: 130.8 },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/v2/portfolios/sqi')) {
        return {
          ok: true,
          json: async () => mockCatalog,
        } as Response;
      }
      return {
        ok: true,
        json: async () => mockHistory,
      } as Response;
    });

    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValue({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValue({} as any);

    const { FundModel } = await import('../../src/shared/models/fund.model.js');
    const { TybaQuotaModel } = await import('../../src/shared/models/quota.model.js');
    const fundBulkSpy = vi.spyOn(FundModel, 'bulkWrite').mockResolvedValue({} as any);
    const quotaBulkSpy = vi.spyOn(TybaQuotaModel, 'bulkWrite').mockResolvedValue({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    const result = await handler({
      authorization: 'valid-jwt-token-long-enough-123',
      xAppProof: 'valid-proof-long-enough-123',
      days: 30,
    });

    expect(result.statusCode).toBe(200);
    expect(result.source).toBe('tyba');
    expect(result.summary.totalFondos).toBe(30);
    expect(result.summary.procesados).toBe(30);
    expect(result.summary.fallidos).toBe(0);
    expect(result.summary.cuotasSincronizadas).toBe(60); // 30 fondos * 2 cuotas
    expect(fundBulkSpy).toHaveBeenCalled();
    expect(quotaBulkSpy).toHaveBeenCalled();
  });

  it('debe ejecutar el ciclo completo pasando ÚNICAMENTE authorization (sin xAppProof) autogenerando cabeceras', async () => {
    const mockCatalog = {
      recommended: [
        {
          id: '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b',
          name: 'CC Renta Futura III',
          currency: 'USD',
          assetType: 'MIXED',
          comission: 0.016,
          risk: 'HIGH',
          riskLevel: 'Alto',
        },
      ],
      notRecommended: [],
    };

    const mockHistory = {
      graphData: [{ interval: '2026-10-06', value: 130.5 }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/v2/portfolios/sqi')) {
        return {
          ok: true,
          json: async () => mockCatalog,
        } as Response;
      }
      return {
        ok: true,
        json: async () => mockHistory,
      } as Response;
    });

    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValue({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValue({} as any);

    const { FundModel } = await import('../../src/shared/models/fund.model.js');
    const { TybaQuotaModel } = await import('../../src/shared/models/quota.model.js');
    vi.spyOn(FundModel, 'bulkWrite').mockResolvedValue({} as any);
    vi.spyOn(TybaQuotaModel, 'bulkWrite').mockResolvedValue({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    // Invocación suministrando ÚNICAMENTE authorization
    const result = await handler({
      authorization: 'valid-jwt-token-long-enough-123',
    });

    expect(result.statusCode).toBe(200);
    expect(result.summary.procesados).toBe(30);

    // Verificar que todas las llamadas HTTP hayan llevado x-app-proof autogenerado de 684 caracteres
    expect(fetchSpy).toHaveBeenCalled();
    for (const call of fetchSpy.mock.calls) {
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers['x-app-proof']).toBeTypeOf('string');
      expect(headers['x-app-proof'].length).toBe(684);
    }
  });

  it('debe aislar fallos individuales en fondos sin abortar el procesamiento global', async () => {
    const mockCatalog = {
      recommended: [],
      notRecommended: [],
    };

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/v2/portfolios/sqi')) {
        return {
          ok: true,
          json: async () => mockCatalog,
        } as Response;
      }
      callCount++;
      // Primer fondo falla con 500
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Error',
          text: async () => 'Fail',
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          graphData: [{ interval: '2026-10-07', value: 100 }],
        }),
      } as Response;
    });

    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValue({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValue({} as any);

    const { FundModel } = await import('../../src/shared/models/fund.model.js');
    const { TybaQuotaModel } = await import('../../src/shared/models/quota.model.js');
    vi.spyOn(FundModel, 'bulkWrite').mockResolvedValue({} as any);
    vi.spyOn(TybaQuotaModel, 'bulkWrite').mockResolvedValue({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    const result = await handler({
      authorization: 'valid-jwt-token-long-enough-123',
      xAppProof: 'valid-proof-long-enough-123',
      days: 30,
    });

    expect(result.statusCode).toBe(200);
    expect(result.summary.fallidos).toBe(1);
    expect(result.summary.procesados).toBe(29);
  });

  it('debe autorefrescar el token ante HTTP 401 si se incluye refreshToken y continuar con éxito', async () => {
    const mockCatalog = {
      recommended: [],
      notRecommended: [],
    };

    let historicAttempts = 0;
    let refreshCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/v2/portfolios/sqi')) {
        return {
          ok: true,
          json: async () => mockCatalog,
        } as Response;
      }
      if (urlStr.includes('/auth/refresh-token')) {
        refreshCalls++;
        return {
          ok: true,
          json: async () => ({ token: 'brand-new-refreshed-jwt-token' }),
        } as Response;
      }

      const headers = options?.headers as Record<string, string>;
      const tokenSent = headers['authorization'];

      // Si la API recibe el token caducado, responde HTTP 401
      if (tokenSent === 'expiring-token-long-enough-123') {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Session expired',
        } as Response;
      }

      // Si recibe el token autorefrescado, responde HTTP 200 con los datos
      if (tokenSent === 'brand-new-refreshed-jwt-token') {
        return {
          ok: true,
          json: async () => ({
            graphData: [{ interval: '2026-10-08', value: 105.2 }],
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Token inválido',
      } as Response;
    });

    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValue({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValue({} as any);

    const { FundModel } = await import('../../src/shared/models/fund.model.js');
    const { TybaQuotaModel } = await import('../../src/shared/models/quota.model.js');
    vi.spyOn(FundModel, 'bulkWrite').mockResolvedValue({} as any);
    vi.spyOn(TybaQuotaModel, 'bulkWrite').mockResolvedValue({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    const result = await handler({
      authorization: 'expiring-token-long-enough-123',
      xAppProof: 'valid-proof-long-enough-123',
      refreshToken: 'my-long-refresh-token-1234567890',
      days: 30,
    });

    expect(result.statusCode).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(result.summary.fallidos).toBe(0);
    expect(result.summary.procesados).toBe(30);
  });

  it('debe fallar ante HTTP 401 en catálogo si no se proveyó refreshToken', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/v2/portfolios/sqi')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Unauthorized catalog',
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const dbModule = await import('../../src/shared/db.js');
    const configModule = await import('../../src/shared/config.js');
    vi.spyOn(dbModule, 'connectToDatabase').mockResolvedValue({} as any);
    vi.spyOn(configModule, 'getConfig').mockResolvedValue({} as any);

    const { handler } = await import('../../src/scrapers/tyba/handler.js');

    await expect(
      handler({
        authorization: 'unauthorized-token-long-enough-123',
        xAppProof: 'valid-proof-long-enough-123',
      })
    ).rejects.toThrow('HTTP 502 Bad Gateway');
  });
});
