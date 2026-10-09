import crypto from 'node:crypto';

/**
 * Clave pública RSA de 4096 bits extraída del bundle de producción de Tyba (web.tyba.pe).
 * Empleada por la aplicación cliente para cifrar la cabecera 'x-app-proof'
 * mediante RSA-OAEP con función hash SHA-256.
 */
export const TYBA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvN3X+YypOhBXOCefxEkq
GVjLuLL4F7YOJu0wpe7EG7WQFqnOU69IHBoU++SvjF7hhZYC/quzBuD405SfN50s
syNqwFYFKy3HPEOkQJRgDfwoqgDFVgc6oajLYg07mCFcKI3IRuF2IrUW/kWY1DBE
oMlnLRep4BbZxk8su22bDpAe9vTXdpcf14aaODXlVfOTj2HVA0h9e8JaHuIc4QR7
K1wOWHpl+bpCZ0bDOk8xVdZcK2eeJ33fR+lThZJSRnleLVa1I3p1imcYIGou/Z3B
xz38WeEdNcYirtV6YP20FRgKkp4KkK2aMif7Vn7YDswOH8e3wIP7RMKKlnHVyYij
tvkVQqV4xm/a9bIh1UhPffVsOaxNUDOoPjWVk5neXd4EMIP2iYiDEWVHdYcfBtTR
0fXqVDE2MEqEfbVmCrp8Aqa8K1rZmcFZiFMn8qc0/3DkznFR/LEMzrIbf8ZU/Xwr
1b2Pe2Dt1R6J2b4JobnU1aZyri4l3AkgbrIfRsmsx7WJyYNZ+5TIyXaE/xH6P/lp
MVzP9bmU7ZDbRl5Y+2i4dQW069aahK9KgZTCf1CXQ4kMo4/VNNJfwooV/4/v2Fze
qYkpiTjAj4dXK4zN1tlRBjbXL3TKfIJfOo7G64iU5yw6G39OUO/gM34mutBc+bGA
QuaSgcGjFvKIe9ZS19sm2WcCAwEAAQ==
-----END PUBLIC KEY-----`;

export const DEFAULT_TYBA_SOURCE_APP = 'TYBA_WEB_PE';
export const DEFAULT_TYBA_VERSION = '5.65.3';

export interface GenerateAppProofOptions {
  sourceApp?: string;
  versionNumber?: string;
  reqUTCDate?: string;
}

/**
 * Genera dinámicamente el valor de la cabecera 'x-app-proof' para una petición específica.
 *
 * Reproduce fielmente el algoritmo criptográfico del cliente Flutter Web de Tyba:
 * 1. Sanitiza la ruta eliminando query parameters y asegurando barra inicial.
 * 2. Construye el payload JSON canónico:
 *    { versionNumber, method, route, reqUTCDate, sourceApp }
 * 3. Cifra el payload con la clave pública RSA de Tyba usando RSA-OAEP con SHA-256.
 * 4. Retorna el resultado codificado en Base64 (longitud esperada: 684 caracteres).
 *
 * @param method Método HTTP ('GET', 'POST', etc.)
 * @param route Ruta relativa del endpoint (ej. '/robo-advisor/v2/portfolios/sqi')
 * @param options Opciones adicionales como sourceApp, versionNumber o reqUTCDate
 * @returns Cadena Base64 con la firma criptográfica 'x-app-proof'
 */
export function generateAppProof(
  method: string,
  route: string,
  options?: GenerateAppProofOptions
): string {
  const cleanRoute = (route.split('?')[0] || '').trim();
  const formattedRoute = cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
  const timestamp = options?.reqUTCDate || new Date().toISOString();
  const sourceApp = options?.sourceApp || DEFAULT_TYBA_SOURCE_APP;
  const versionNumber = options?.versionNumber || DEFAULT_TYBA_VERSION;

  const payload = JSON.stringify({
    versionNumber,
    method: method.toUpperCase(),
    route: formattedRoute,
    reqUTCDate: timestamp,
    sourceApp,
  });

  const buffer = Buffer.from(payload, 'utf8');
  const encrypted = crypto.publicEncrypt(
    {
      key: TYBA_PUBLIC_KEY_PEM,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );

  return encrypted.toString('base64');
}
