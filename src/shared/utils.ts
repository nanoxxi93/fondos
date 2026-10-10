/**
 * Ejecuta una función asíncrona sobre cada elemento de un array limitando
 * el número máximo de ejecuciones concurrentes en paralelo.
 *
 * @param items Elementos a procesar
 * @param mapper Función asíncrona aplicada a cada elemento
 * @param concurrency Número máximo de llamadas simultáneas (por defecto 4)
 * @returns Array con los resultados preservando el orden original
 */
export async function pMap<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Normaliza cualquier fecha (ISO string, Date o timestamp) al inicio
 * exacto del día en horario UTC (00:00:00.000Z).
 */
export function toUtcMidnight(input: string | Date | number): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha inválida: ${String(input)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Formatea una fecha al estándar YYYY-MM-DD.
 */
export function toIsoDateString(date: Date): string {
  return toUtcMidnight(date).toISOString().slice(0, 10);
}

/**
 * Capitaliza la primera letra de cada palabra en una cadena de texto.
 */
export function capitalize(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/**
 * Normaliza y sanea el nombre de un fondo mutuo removiendo prefijos redundantes
 * como "Fondo de Fondos" o "FDF", asegurando que los fondos de BBVA conserven su prefijo
 * canónico (ej. "BBVA Acciones...") y que los fondos de ERNI comiencen directamente en "IF...".
 *
 * @param name Nombre original del fondo
 * @param source Fuente del fondo opcional ('bbva' | 'erni' | 'tyba')
 * @returns Nombre normalizado sin prefijos redundantes
 */
export function normalizeFundName(name: string, source?: string): string {
  if (!name) {
    return "";
  }

  let cleaned = name.trim();

  // 1. Remover prefijo 'Fondo de Fondos' o 'Fondo De Fondos'
  cleaned = cleaned.replace(/^fondo\s+de\s+fondos\s+/i, "");

  // 2. Remover prefijo 'FDF ' o 'FDF_'
  cleaned = cleaned.replace(/^fdf[\s_]+/i, "");

  // 3. Caso especial BBVA: si es el fondo Real Estate sin prefijo BBVA, asegurar 'BBVA Acciones...'
  if (/^acciones\s+globales\s+real\s+estate/i.test(cleaned)) {
    cleaned = `BBVA ${cleaned}`;
  }

  // 4. Normalizar espacios múltiples intermedios
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

export interface ColorScheme {
  backgroundColor: string;
  borderColor: string;
}

/**
 * Genera determinísticamente una combinación de colores HSL basada en el hash
 * de una clave (ej. "${source}:${id}"), garantizando colores idénticos entre renderizados.
 */
export function colorFromKey(key: string): ColorScheme {
  let hash = 0;
  for (const char of String(key)) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsla(${hue}, 70%, 50%, 0.2)`,
    borderColor: `hsla(${hue}, 70%, 40%, 1)`,
  };
}

/**
 * Escapa caracteres especiales en cadenas para prevenir inyecciones HTML (XSS).
 */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Serializa de forma segura un valor a JSON escapando caracteres '<'
 * para evitar inyecciones en etiquetas <script>.
 */
export function toSafeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/**
 * Parsea el número de días para la serie temporal dentro del rango [1, 3650].
 */
export function parseDays(value: unknown, fallback = 30): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(Math.max(n, 1), 3650);
}

/**
 * Parsea y sanea el parámetro de moneda restringiéndolo a 'PEN' o 'USD'.
 */
export function parseCurrency(value: unknown): "PEN" | "USD" | undefined {
  if (!value) {
    return undefined;
  }
  const currency = String(value).trim().toUpperCase();
  return currency === "PEN" || currency === "USD" ? currency : undefined;
}

/**
 * Parsea el parámetro de nivel de riesgo máximo como entero válido.
 */
export function parseRisk(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : undefined;
}

