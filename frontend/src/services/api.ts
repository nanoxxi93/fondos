import type { HealthResponse, TeaChartData } from '../types/funds.js';

// En desarrollo con Vite usamos ruta relativa '' para que el proxy de Vite
// reenvíe las peticiones a Fly.io o al backend sin restricciones de CORS en el navegador.
// En producción (ej. GitHub Pages) o con VITE_DIRECT_API=true se utiliza la URL absoluta configurada.
const API_BASE_URL: string = (
  import.meta.env.DEV && !import.meta.env.VITE_DIRECT_API
    ? ''
    : (import.meta.env.VITE_API_BASE_URL || 'https://fondos-purple-fog-9801.fly.dev')
).replace(/\/+$/, '');

export interface FetchTeaParams {
  days?: number;
  currency?: 'PEN' | 'USD' | '';
  risk?: number;
}

/**
 * Consulta el endpoint analítico /api/tea en la Lambda Function URL
 * o en el servidor local utilizando fetch nativo.
 */
export async function fetchTeaData(params: FetchTeaParams = {}): Promise<TeaChartData> {
  const query = new URLSearchParams();

  if (params.days !== undefined && params.days > 0) {
    query.set('days', String(params.days));
  }
  if (params.currency && (params.currency === 'PEN' || params.currency === 'USD')) {
    query.set('currency', params.currency);
  }
  if (params.risk !== undefined && params.risk >= 1 && params.risk <= 7) {
    query.set('risk', String(params.risk));
  }

  const queryString = query.toString();
  const url = `${API_BASE_URL}/api/tea${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody && typeof errBody.error === 'string') {
        errorMsg = errBody.error;
      }
    } catch {
      // Ignorar fallo de parseo si no era JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Consulta el endpoint /health para verificar la conectividad con MongoDB Atlas
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/health`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check falló con status ${response.status}`);
  }

  const rawText = (await response.text()).trim();
  try {
    const data = JSON.parse(rawText);
    if (data && typeof data.status === 'string') {
      return data as HealthResponse;
    }
  } catch {
    // Si no es JSON (como en Fly.io que responde texto "OK"), verificar contenido
  }

  const isOk = rawText.toUpperCase().includes('OK');
  return {
    status: isOk ? 'OK' : 'Mongo unavailable',
    timestamp: new Date().toISOString(),
  };
}
