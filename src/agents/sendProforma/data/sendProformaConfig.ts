import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

type ConfigRow = {
  cfclave: string;
  cfvalor: string;
};

const SEND_PROFORMA_EMAIL_ACTIVE_KEY = 'sendproforma.email.active';
const SEND_PROFORMA_WHATSAPP_ACTIVE_KEY = 'sendproforma.whatsapp.active';
const SEND_PROFORMA_WHATSAPP_API_KEY = 'sendproforma.whatsapp.api';
const SEND_PROFORMA_LOG_PREFIX = '[sendProformaTask]';

type SendProformaChannel = 'email' | 'whatsapp';

const FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY = `
  select cfvalor
  from configuracion
  where cfclave = 'sendproforma.email.empresa'
  limit 1
`;

async function findSendProformaConfiguredCompanyRucValue(): Promise<string | undefined> {
  try {
    const rows = await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_CONFIGURED_COMPANY_RUC_QUERY);
    const row = rows[0];
    return row?.cfvalor;
  } catch (error) {
    logger.error(
      { err: error },
      `${SEND_PROFORMA_LOG_PREFIX} Error al buscar las empresas configuradas para envío de proforma`,
    );
    throw new Error('Error al buscar las empresas configuradas para envío de proforma');
  }
}

const FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY = `
  select cfclave, cfvalor
  from configuracion
  where cfemid = $1 and cfclave like 'sendproforma%'
`;

async function findSendProformaCompanyConfigRows(sendemid: string): Promise<ConfigRow[]> {
  try {
    return await sql.unsafe<ConfigRow[]>(FIND_SEND_PROFORMA_COMPANY_CONFIG_ROWS_QUERY, [sendemid]);
  } catch (error) {
    logger.error(
      { err: error, sendemid },
      `${SEND_PROFORMA_LOG_PREFIX} Error al buscar la configuración de envío de proforma de la empresa`,
    );
    throw new Error('Error al buscar la configuración de envío de proforma de la empresa');
  }
}

async function findSendProformaCompanyConfigMap(sendemid: string): Promise<Record<string, string>> {
  const configRows = await findSendProformaCompanyConfigRows(sendemid);
  const configMap: Record<string, string> = {};

  for (const row of configRows) {
    configMap[row.cfclave] = row.cfvalor;
  }

  return configMap;
}

function readBooleanConfigValue(
  sendemid: string,
  configMap: Record<string, string>,
  configKey: string,
  logMissing = true,
): boolean {
  const configValue = configMap[configKey];
  if (configValue === undefined) {
    if (logMissing) {
      logger.warn(
        { sendemid, key: configKey },
        `${SEND_PROFORMA_LOG_PREFIX} Send proforma config not found for company`,
      );
    }
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
    { sendemid, key: configKey, value: configValue },
    `${SEND_PROFORMA_LOG_PREFIX} Invalid send proforma config value`,
  );
  return false;
}

async function findSendProformaCompanyEmailActive(sendemid: string): Promise<boolean> {
  const configMap = await findSendProformaCompanyConfigMap(sendemid);

  return readBooleanConfigValue(sendemid, configMap, SEND_PROFORMA_EMAIL_ACTIVE_KEY);
}

async function findSendProformaCompanyWhatsappActive(sendemid: string): Promise<boolean> {
  const configMap = await findSendProformaCompanyConfigMap(sendemid);

  return readBooleanConfigValue(sendemid, configMap, SEND_PROFORMA_WHATSAPP_ACTIVE_KEY);
}

async function findSendProformaCompanyWhatsappApi(sendemid: string): Promise<string | null> {
  const configMap = await findSendProformaCompanyConfigMap(sendemid);
  const instanceValue = configMap[SEND_PROFORMA_WHATSAPP_API_KEY];

  if (typeof instanceValue !== 'string') {
    logger.warn(
      { sendemid, key: SEND_PROFORMA_WHATSAPP_API_KEY },
      `${SEND_PROFORMA_LOG_PREFIX} Send proforma whatsapp api config not found for company`,
    );
    return null;
  }

  const normalizedValue = instanceValue.trim();
  if (normalizedValue.length === 0) {
    logger.warn(
      { sendemid, key: SEND_PROFORMA_WHATSAPP_API_KEY },
      `${SEND_PROFORMA_LOG_PREFIX} Send proforma whatsapp api config is empty for company`,
    );
    return null;
  }

  return normalizedValue;
}

async function findSendProformaCompanyChannel(
  sendemid: string,
): Promise<SendProformaChannel | null> {
  const configMap = await findSendProformaCompanyConfigMap(sendemid);
  const isEmailActive = readBooleanConfigValue(
    sendemid,
    configMap,
    SEND_PROFORMA_EMAIL_ACTIVE_KEY,
    false,
  );

  if (isEmailActive) {
    const isWhatsappActive = readBooleanConfigValue(
      sendemid,
      configMap,
      SEND_PROFORMA_WHATSAPP_ACTIVE_KEY,
      false,
    );

    if (isWhatsappActive) {
      logger.info(
        { sendemid },
        `${SEND_PROFORMA_LOG_PREFIX} Send proforma channel resolved to email because it has priority over whatsapp`,
      );
    }

    return 'email';
  }

  const isWhatsappActive = readBooleanConfigValue(
    sendemid,
    configMap,
    SEND_PROFORMA_WHATSAPP_ACTIVE_KEY,
    false,
  );
  if (isWhatsappActive) {
    return 'whatsapp';
  }

  return null;
}

export {
  findSendProformaCompanyChannel,
  findSendProformaConfiguredCompanyRucValue,
  findSendProformaCompanyConfigRows,
  findSendProformaCompanyEmailActive,
  findSendProformaCompanyWhatsappActive,
  findSendProformaCompanyWhatsappApi,
};
export type { SendProformaChannel };
