import postgres from 'postgres';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

function createDatabaseConnection(): postgres.Sql {
  const sql = postgres(env.databaseUrl, {
    onnotice: handleDatabaseNotice,
  });

  return sql;
}

function handleDatabaseNotice(notice: postgres.Notice): void {
  logger.info({ notice }, 'Aviso de la base de datos');
}

const sql = createDatabaseConnection();

export { sql };
