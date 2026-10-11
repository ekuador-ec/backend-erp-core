import { app } from './app.js';
import { env } from './config/env.js';
import { sql } from './config/database.js';
import { logger } from './utils/logger.js';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'Servidor en ejecución');
});

const handleServerStartError = (error: Error): void => {
  logger.error({ err: error }, 'Error al iniciar el servidor');
  process.exit(EXIT_FAILURE);
};

async function closeDatabaseConnection(): Promise<void> {
  await sql.end();
}

const shutdown = (signal: NodeJS.Signals): void => {
  logger.info({ signal }, 'Apagando el servidor');

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'Error al apagar el servidor');
      process.exit(EXIT_FAILURE);
    }

    try {
      await closeDatabaseConnection();
      process.exit(EXIT_SUCCESS);
    } catch (databaseError) {
      logger.error({ err: databaseError }, 'Error al cerrar la conexión de base de datos');
      process.exit(EXIT_FAILURE);
    }
  });
};

server.on('error', handleServerStartError);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
