import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

const STOCK_ALERT_LOG_PREFIX = '[stockAlertTask]';
const STOCK_ALERT_COMPANY_ACTIVE_KEY = 'stockalert.alerta.active';
const STOCK_ALERT_COMPANY_TIME_KEY = 'stockalert.alerta.time';
const DEFAULT_STOCK_ALERT_REMINDER_MINUTES = 30;

type ConfigRow = {
  cfclave: string;
  cfvalor: string;
};

type StockAlertCompanyConfig = {
  active: boolean;
  reminderMinutes: number;
};

const FIND_STOCK_ALERT_CONFIGURED_COMPANY_RUC_QUERY = `
  select cfvalor
  from configuracion
  where cfclave = 'stockalert.alerta.empresa'
  limit 1
`;

async function findStockAlertConfiguredCompanyRucValue(): Promise<string | undefined> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_STOCK_ALERT_CONFIGURED_COMPANY_RUC_QUERY);
    const row = rows[0];
    return row?.cfvalor;
  } catch (error) {
    logger.error(
      { err: error },
      `${STOCK_ALERT_LOG_PREFIX} Error al buscar las empresas configuradas para alertas de stock`,
    );
    throw new Error('Error al buscar las empresas configuradas para alertas de stock');
  }
}

const FIND_STOCK_ALERT_COMPANY_CONFIG_ROWS_QUERY = `
  select cfclave, cfvalor
  from configuracion
  where cfemid = $1 and cfclave like 'stockalert.alerta.%'
`;

async function findStockAlertCompanyConfigRows(emid: string): Promise<ConfigRow[]> {
  try {
    return await sql.unsafe<ConfigRow[]>(FIND_STOCK_ALERT_COMPANY_CONFIG_ROWS_QUERY, [emid]);
  } catch (error) {
    logger.error(
      { err: error, emid },
      `${STOCK_ALERT_LOG_PREFIX} Error al buscar la configuración de alertas de stock de la empresa`,
    );
    throw new Error('Error al buscar la configuración de alertas de stock de la empresa');
  }
}

async function findStockAlertCompanyConfigMap(emid: string): Promise<Record<string, string>> {
  const configRows = await findStockAlertCompanyConfigRows(emid);
  const configMap: Record<string, string> = {};

  for (const row of configRows) {
    configMap[row.cfclave] = row.cfvalor;
  }

  return configMap;
}

function readBooleanConfigValue(
  emid: string,
  configMap: Record<string, string>,
  configKey: string,
): boolean {
  const configValue = configMap[configKey];

  if (configValue === undefined) {
    logger.warn(
      { emid, key: configKey },
      `${STOCK_ALERT_LOG_PREFIX} Stock alert config not found for company`,
    );
    return false;
  }

  const normalizedValue = configValue.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  logger.warn(
    { emid, key: configKey, value: configValue },
    `${STOCK_ALERT_LOG_PREFIX} Invalid stock alert boolean config value`,
  );
  return false;
}

function readReminderMinutesConfigValue(
  emid: string,
  configMap: Record<string, string>,
  configKey: string,
): number {
  const configValue = configMap[configKey];

  if (configValue === undefined) {
    logger.warn(
      { emid, key: configKey, fallback: DEFAULT_STOCK_ALERT_REMINDER_MINUTES },
      `${STOCK_ALERT_LOG_PREFIX} Stock alert reminder config not found for company`,
    );
    return DEFAULT_STOCK_ALERT_REMINDER_MINUTES;
  }

  const parsedValue = Number(configValue.trim());
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    logger.warn(
      { emid, key: configKey, value: configValue, fallback: DEFAULT_STOCK_ALERT_REMINDER_MINUTES },
      `${STOCK_ALERT_LOG_PREFIX} Invalid stock alert reminder config value`,
    );
    return DEFAULT_STOCK_ALERT_REMINDER_MINUTES;
  }

  return parsedValue;
}

async function findStockAlertCompanyAlertConfig(emid: string): Promise<StockAlertCompanyConfig> {
  const configMap = await findStockAlertCompanyConfigMap(emid);
  const active = readBooleanConfigValue(emid, configMap, STOCK_ALERT_COMPANY_ACTIVE_KEY);

  if (!active) {
    return {
      active,
      reminderMinutes: DEFAULT_STOCK_ALERT_REMINDER_MINUTES,
    };
  }

  return {
    active,
    reminderMinutes: readReminderMinutesConfigValue(emid, configMap, STOCK_ALERT_COMPANY_TIME_KEY),
  };
}

export { findStockAlertCompanyAlertConfig, findStockAlertConfiguredCompanyRucValue };
export type { StockAlertCompanyConfig };
