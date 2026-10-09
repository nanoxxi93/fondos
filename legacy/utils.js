export function dateRange(days = 30) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - days);

  const toISO = to.toISOString().slice(0, 10);
  const fromISO = from.toISOString().slice(0, 10);

  return {
    fromISO,
    toISO,
    fromCompact: fromISO.replaceAll("-", ""),
    toCompact: toISO.replaceAll("-", ""),
  };
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = new Error(`${res.status} ${res.statusText}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function isClientError(error) {
  return Number(error.status) >= 400 && Number(error.status) < 500;
}

export async function upsertQuotas(Model, docs) {
  if (!docs?.length) {
    return;
  }

  await Model.bulkWrite(
    docs.map(({ idFondo, idSerie = null, date, value }) => ({
      updateOne: {
        filter: { idFondo, idSerie, date },
        update: { $set: { value } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

export function parseDays(value, fallback = 30) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(Math.max(n, 1), 3650);
}

export function parseCurrency(value) {
  if (!value) {
    return undefined;
  }
  const currency = String(value).toUpperCase();
  return currency === "PEN" || currency === "USD" ? currency : undefined;
}

export function parseRisk(value) {
  if (value === undefined || value === "") {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function capitalize(str) {
  return str.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

export function colorFromKey(key) {
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

export function toSafeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
