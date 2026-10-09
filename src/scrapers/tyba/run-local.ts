import 'dotenv/config';
import { handler } from './handler.js';
import { disconnectDatabase } from '../../shared/db.js';
import { fetchPortfoliosCatalog, fetchHistoricPerformance } from './client.js';
import { sanitizeAuthToken, normalizeHistoricQuotas } from './parser.js';

interface CliArgs {
  authorization?: string;
  appProof?: string;
  refreshToken?: string;
  days?: number;
  all?: boolean;
  dryRun?: boolean;
}

function parseCliArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--authorization' || arg === '-a') {
      args.authorization = argv[++i];
    } else if (arg === '--app-proof' || arg === '-p') {
      args.appProof = argv[++i];
    } else if (arg === '--refresh-token' || arg === '-r') {
      args.refreshToken = argv[++i];
    } else if (arg === '--days' || arg === '-d') {
      args.days = parseInt(argv[++i], 10);
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

async function main(): Promise<void> {
  console.info('=== Iniciando ejecución local para ingesta de Tyba ===');

  const cli = parseCliArgs();
  const rawAuth =
    cli.authorization ||
    process.env.TYBA_AUTHORIZATION ||
    process.env.TYBA_APIKEY;
  const rawProof = cli.appProof || process.env.TYBA_APP_PROOF;
  const rawRefresh = cli.refreshToken || process.env.TYBA_REFRESH_TOKEN;

  const authorization = sanitizeAuthToken(rawAuth);
  const appProof = (rawProof || '').trim() || undefined;
  const refreshToken = (rawRefresh || '').trim() || undefined;
  const days = cli.days || (process.env.DAYS ? parseInt(process.env.DAYS, 10) : 300);
  const all = cli.all || false;

  if (!authorization) {
    console.error(
      'Error: Se requiere authorization. Proporciónalo vía flags (--authorization / -a) o en tu archivo .env (TYBA_APIKEY / TYBA_AUTHORIZATION).'
    );
    process.exit(1);
  }

  if (!appProof) {
    console.info(
      'Cabecera x-app-proof no especificada: se autogenerará dinámicamente mediante criptografía RSA-4096.'
    );
  }

  const isDryRun = cli.dryRun || !process.env.MONGO_DB_URI;

  if (isDryRun) {
    console.info(
      'Modo DRY-RUN activo (sin persistencia en MongoDB Atlas). Verificando APIs en vivo...'
    );

    console.info('1. Consultando catálogo general de Tyba (/v2/portfolios/sqi)...');
    const catalog = await fetchPortfoliosCatalog(authorization, appProof);
    console.info(
      `Catálogo obtenido exitosamente: ${catalog.recommended.length} recomendados, ${catalog.notRecommended.length} no recomendados.`
    );

    const sampleFundIds = [
      '8c2f0120-5156-53ca-b9e7-7fb7059a3a6b', // CC Renta Futura III
      '4f28ebf4-6d3c-53f0-9a48-8e415e83f323', // CC Acciones China
      'bd2445cd-a8b1-5d84-9e32-5838e19d78e1', // CC Liquidez Soles
    ];

    console.info('2. Verificando extracción de cuotas históricas para fondos de muestra...');
    for (const fundId of sampleFundIds) {
      const hist = await fetchHistoricPerformance(fundId, authorization, appProof);
      const quotas = normalizeHistoricQuotas(fundId, hist.graphData, days, all);
      console.info(
        `Fondo [${fundId}]: ${hist.graphData.length} puntos totales devueltos, ${quotas.length} cuotas recortadas.`
      );
    }

    console.info(
      'Prueba de APIs de Tyba completada exitosamente. Para persistir datos en MongoDB, configura MONGO_DB_URI en .env y ejecuta sin --dry-run.'
    );
    return;
  }

  // Ejecución completa con base de datos
  const result = await handler({
    authorization,
    xAppProof: appProof,
    refreshToken,
    days,
    all,
  });

  console.info('Resultado de ejecución completa Tyba:', JSON.stringify(result, null, 2));
  await disconnectDatabase();
}

if (process.argv[1]?.includes('run-local')) {
  main().catch((err) => {
    console.error('Error en ejecución local de Tyba:', err);
    process.exit(1);
  });
}
