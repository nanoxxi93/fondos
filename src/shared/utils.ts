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
