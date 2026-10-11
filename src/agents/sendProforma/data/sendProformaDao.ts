import { sql } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';
import type { SendProformaModel } from './sendProformaModel.js';

const SEND_PROFORMA_LOG_PREFIX = '[sendProformaTask]';

const CLAIM_PENDING_SEND_PROFORMAS_BY_COMPANY_RUC_QUERY = `
  with claimed as (
    select sendid
    from sendproforma
    where sendestado = 'pendiente' and sendemruc = $1
    order by sendfchcreacion asc
    limit $2
    for update skip locked
  )
  update sendproforma sp
  set sendestado = 'procesando',
      sendfchactualizacion = current_timestamp
  from claimed
  where sp.sendid = claimed.sendid
  returning sp.*
`;

async function claimPendingSendProformasByCompanyRuc(
  sendemruc: string,
  limit: number,
): Promise<SendProformaModel[]> {
  try {
    return await sql.unsafe<SendProformaModel[]>(
      CLAIM_PENDING_SEND_PROFORMAS_BY_COMPANY_RUC_QUERY,
      [sendemruc, limit],
    );
  } catch (error) {
    logger.error(
      { err: error, sendemruc, limit },
      `${SEND_PROFORMA_LOG_PREFIX} Error al reclamar las tareas pendientes de envío de proforma por RUC de empresa`,
    );
    throw new Error(
      'Error al reclamar las tareas pendientes de envío de proforma por RUC de empresa',
    );
  }
}

const MARK_SEND_PROFORMA_COMPLETED_QUERY = `
  update sendproforma
  set sendestado = 'completado',
      senderror = null,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaCompleted(sendid: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_COMPLETED_QUERY, [sendid]);
  } catch (error) {
    logger.error(
      { err: error, sendid },
      `${SEND_PROFORMA_LOG_PREFIX} Error al marcar la tarea de envío de proforma como completada`,
    );
    throw new Error('Error al marcar la tarea de envío de proforma como completada');
  }
}

const MARK_SEND_PROFORMA_ERROR_RETRYABLE_QUERY = `
  update sendproforma
  set sendestado = case
        when sendintentos + 1 >= 3 then 'fallido'
        else 'pendiente'
      end,
      senderror = $2,
      sendintentos = sendintentos + 1,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaErrorRetryable(sendid: string, errorMessage: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_ERROR_RETRYABLE_QUERY, [sendid, errorMessage]);
  } catch (error) {
    logger.error(
      { err: error, sendid },
      `${SEND_PROFORMA_LOG_PREFIX} Error al marcar la tarea de envío de proforma como error reintentable`,
    );
    throw new Error('Error al marcar la tarea de envío de proforma como error reintentable');
  }
}

const MARK_SEND_PROFORMA_ERROR_FINAL_QUERY = `
  update sendproforma
  set sendestado = 'fallido',
      senderror = $2,
      sendintentos = sendintentos + 1,
      sendfchactualizacion = current_timestamp
  where sendid = $1
`;

async function markSendProformaErrorFinal(sendid: string, errorMessage: string): Promise<void> {
  try {
    await sql.unsafe(MARK_SEND_PROFORMA_ERROR_FINAL_QUERY, [sendid, errorMessage]);
  } catch (error) {
    logger.error(
      { err: error, sendid },
      `${SEND_PROFORMA_LOG_PREFIX} Error al marcar la tarea de envío de proforma como error final`,
    );
    throw new Error('Error al marcar la tarea de envío de proforma como error final');
  }
}

export {
  claimPendingSendProformasByCompanyRuc,
  markSendProformaCompleted,
  markSendProformaErrorRetryable,
  markSendProformaErrorFinal,
};
