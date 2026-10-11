import { env } from '../../../config/env.js';
import { findCompanyByRuc } from '../../../modules/company/companyDao.js';
import { sendEmail } from '../../../services/nodemailer.js';
import { logger } from '../../../utils/logger.js';
import {
  claimPendingSendProformasByCompanyRuc,
  markSendProformaCompleted,
  markSendProformaErrorFinal,
  markSendProformaErrorRetryable,
} from '../data/sendProformaDao.js';
import {
  findSendProformaCompanyChannel,
  findSendProformaConfiguredCompanyRucValue,
  findSendProformaCompanyWhatsappApi,
} from '../data/sendProformaConfig.js';
import type { SendProformaModel } from '../data/sendProformaModel.js';
import { getCompanyTransporter, isFileAccessError } from '../email/sendProformaTransporter.js';
import {
  buildSendProformaEmailBody,
  resolveDocumentPath,
  validateDocumentAccess,
} from '../email/sendProformaTemplate.js';
import { sendProformaByWhatsapp } from '../whatsapp/sendProformaWhatsappTransporter.js';

const SEND_PROFORMA_COMPANY_RUC_SEPARATOR = ';';
const SEND_PROFORMA_PER_COMPANY_LIMIT = 10;
const AGENT_POLL_INTERVAL_MS = 240000;
const SEND_PROFORMA_LOG_PREFIX = '[sendProformaTask]';
const SEND_PROFORMA_EMAIL_LOG_PREFIX = '[sendProformaEmail]';
const SEND_PROFORMA_WHATSAPP_LOG_PREFIX = '[sendProformaWhatsapp]';

type CompanyChannelConfig =
  | {
      channel: 'email';
    }
  | {
      channel: 'whatsapp';
      whatsappApiInstance: string;
    };

async function findConfiguredCompanyRucs(): Promise<string[]> {
  try {
    const rucValue = await findSendProformaConfiguredCompanyRucValue();

    if (!rucValue) {
      return [];
    }

    return rucValue.split(SEND_PROFORMA_COMPANY_RUC_SEPARATOR);
  } catch (error) {
    logger.error({ err: error }, `${SEND_PROFORMA_LOG_PREFIX} Error al obtener RUCs configurados`);
    throw error;
  }
}

async function processSingleEmailTask(task: SendProformaModel): Promise<boolean> {
  logger.info(
    `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Iniciando envío de la proforma: ${task.sendprfmaidentificador}`,
  );

  try {
    const fromAddress = env.smtpFrom ?? task.sendemcorreo;
    const recipientEmail = task.sendclntecorreo;

    if (!fromAddress || !recipientEmail) {
      logger.error(
        {
          sendid: task.sendid,
          sendemid: task.sendemid,
          hasFromAddress: Boolean(fromAddress),
          hasRecipientEmail: Boolean(recipientEmail),
        },
        `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Faltan datos obligatorios para envío por email`,
      );
      await markSendProformaErrorFinal(
        task.sendid,
        `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Missing sender or recipient email for send proforma`,
      );

      return false;
    }

    const documentPath = resolveDocumentPath(task.sendprfmadocumento);
    const emailHtml = await buildSendProformaEmailBody(task);
    const transporter = await getCompanyTransporter(task.sendemid);

    logger.info(`${SEND_PROFORMA_EMAIL_LOG_PREFIX} Validando acceso al documento`);
    await validateDocumentAccess(documentPath);

    logger.info(`${SEND_PROFORMA_EMAIL_LOG_PREFIX} Enviando correo con la proforma adjunta`);
    await sendEmail(transporter, {
      from: fromAddress,
      to: [recipientEmail],
      subject: `Proforma ${task.sendprfmaidentificador}`,
      html: emailHtml,
      text: `Estimado/a ${task.sendclntenombre}, adjuntamos su proforma ${task.sendprfmaidentificador}.`,
      attachments: [
        {
          filename: `${task.sendprfmaidentificador}.pdf`,
          path: documentPath,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info(`${SEND_PROFORMA_EMAIL_LOG_PREFIX} Proforma enviada correctamente`);
    await markSendProformaCompleted(task.sendid);
    logger.info(`${SEND_PROFORMA_LOG_PREFIX} Proforma marcada como completada`);

    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al enviar proforma';

    if (isFileAccessError(error) && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      logger.error(
        {
          err: error,
          documentPath: task.sendprfmadocumento,
          sendemid: task.sendemid,
          sendemruc: task.sendemruc,
          sendid: task.sendid,
        },
        `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Error de acceso al documento de la proforma`,
      );
      await markSendProformaErrorFinal(
        task.sendid,
        `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Error de acceso al documento para la proforma ${task.sendprfmaidentificador}: ${errorMessage}`,
      );
      return false;
    }

    logger.error(
      { err: error, sendemid: task.sendemid, sendemruc: task.sendemruc, sendid: task.sendid },
      `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Error al procesar tarea de envío de proforma`,
    );
    await markSendProformaErrorRetryable(task.sendid, errorMessage);
    return false;
  }
}

async function processSingleWhatsappTask(
  task: SendProformaModel,
  whatsappApiInstance: string,
): Promise<boolean> {
  logger.info(
    `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Iniciando envío de la proforma: ${task.sendprfmaidentificador}`,
  );

  try {
    logger.info(`${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Enviando proforma por whatsapp`);
    await sendProformaByWhatsapp(task, whatsappApiInstance);

    logger.info(`${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Proforma enviada correctamente`);
    await markSendProformaCompleted(task.sendid);
    logger.info(`${SEND_PROFORMA_LOG_PREFIX} Proforma marcada como completada`);

    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al enviar proforma por WhatsApp';

    if (isFileAccessError(error) && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      logger.error(
        {
          err: error,
          documentPath: task.sendprfmadocumento,
          sendemid: task.sendemid,
          sendemruc: task.sendemruc,
          sendid: task.sendid,
        },
        `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Error de acceso al documento de la proforma`,
      );
      await markSendProformaErrorFinal(
        task.sendid,
        `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Error de acceso al documento para la proforma ${task.sendprfmaidentificador}: ${errorMessage}`,
      );
      return false;
    }

    logger.error(
      { err: error, sendemid: task.sendemid, sendemruc: task.sendemruc, sendid: task.sendid },
      `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Error al procesar tarea de envío de proforma`,
    );
    await markSendProformaErrorRetryable(task.sendid, errorMessage);
    return false;
  }
}

async function processCompanySendBatch(
  ruc: string,
  companyChannelConfig: CompanyChannelConfig,
): Promise<number> {
  const pendingTasks = await claimPendingSendProformasByCompanyRuc(
    ruc,
    SEND_PROFORMA_PER_COMPANY_LIMIT,
  );

  if (pendingTasks.length === 0) {
    return 0;
  }

  logger.info(
    { ruc, tasks: pendingTasks.length },
    `${SEND_PROFORMA_LOG_PREFIX} Tareas pendientes encontradas para empresa`,
  );

  let completedTasks = 0;

  for (const task of pendingTasks) {
    try {
      const completed =
        companyChannelConfig.channel === 'email'
          ? await processSingleEmailTask(task)
          : await processSingleWhatsappTask(task, companyChannelConfig.whatsappApiInstance);

      if (completed) {
        completedTasks += 1;
        logger.info(
          { sendid: task.sendid },
          `${SEND_PROFORMA_LOG_PREFIX} Tarea de envío completada`,
        );
      } else {
        logger.warn(
          { sendid: task.sendid },
          `${SEND_PROFORMA_LOG_PREFIX} Tarea de envío no completada`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido al enviar proforma';
      await markSendProformaErrorRetryable(task.sendid, errorMessage);
      logger.error(
        { sendid: task.sendid, err: error },
        `${SEND_PROFORMA_LOG_PREFIX} Error al procesar tarea`,
      );
    }
  }

  return completedTasks;
}

async function runSendProformaIteration(): Promise<void> {
  try {
    const companyRucs = await findConfiguredCompanyRucs();

    if (companyRucs.length === 0) {
      logger.info(`${SEND_PROFORMA_LOG_PREFIX} No hay RUCs configurados para el agente`);
      return;
    }

    logger.info(`${SEND_PROFORMA_LOG_PREFIX} RUCs configurados: ${companyRucs.length}`);
    let totalSent = 0;

    for (const ruc of companyRucs) {
      const cleanedRuc = ruc.trim();
      if (!cleanedRuc) {
        continue;
      }

      logger.info(`${SEND_PROFORMA_LOG_PREFIX} Procesando empresa con RUC: ${cleanedRuc}`);

      try {
        const companyId = await findCompanyByRuc(cleanedRuc);
        if (!companyId) {
          logger.warn(
            { ruc: cleanedRuc },
            `${SEND_PROFORMA_LOG_PREFIX} No se encontró empresa con RUC configurado`,
          );
          continue;
        }

        const companyChannel = await findSendProformaCompanyChannel(companyId);
        if (!companyChannel) {
          logger.info(
            { ruc: cleanedRuc, sendemid: companyId },
            `${SEND_PROFORMA_LOG_PREFIX} Empresa omitida porque no tiene canal activo para sendproforma`,
          );
          continue;
        }

        let companyChannelConfig: CompanyChannelConfig;
        if (companyChannel === 'email') {
          companyChannelConfig = {
            channel: 'email',
          };
          logger.info(
            { ruc: cleanedRuc, sendemid: companyId },
            `${SEND_PROFORMA_EMAIL_LOG_PREFIX} Empresa habilitada para envío por email`,
          );
        } else {
          if (!env.whatsappApiconsultToken) {
            logger.warn(
              { ruc: cleanedRuc, sendemid: companyId },
              `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Empresa omitida porque falta WHATSAPP_APICONSULT_TOKEN para el canal whatsapp`,
            );
            continue;
          }

          const whatsappApiInstance = await findSendProformaCompanyWhatsappApi(companyId);
          if (!whatsappApiInstance) {
            logger.warn(
              { ruc: cleanedRuc, sendemid: companyId },
              `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Empresa omitida porque no tiene sendproforma.whatsapp.api configurado`,
            );
            continue;
          }

          companyChannelConfig = {
            channel: 'whatsapp',
            whatsappApiInstance,
          };
          logger.info(
            { ruc: cleanedRuc, sendemid: companyId, instance: whatsappApiInstance },
            `${SEND_PROFORMA_WHATSAPP_LOG_PREFIX} Empresa habilitada para envío por whatsapp`,
          );
        }

        const sent = await processCompanySendBatch(cleanedRuc, companyChannelConfig);
        totalSent += sent;
        logger.info({ ruc: cleanedRuc, sent }, `${SEND_PROFORMA_LOG_PREFIX} Empresa procesada`);
      } catch (error) {
        logger.error(
          { err: error, ruc: cleanedRuc },
          `${SEND_PROFORMA_LOG_PREFIX} Error al procesar empresa`,
        );
      }
    }

    if (totalSent > 0) {
      logger.info(
        { totalSent },
        `${SEND_PROFORMA_LOG_PREFIX} Proformas enviadas en esta iteración`,
      );
    } else {
      logger.info(`${SEND_PROFORMA_LOG_PREFIX} No hay proformas pendientes`);
    }
  } catch (error) {
    logger.error({ err: error }, `${SEND_PROFORMA_LOG_PREFIX} Error en la iteración del agente`);
  }
}

async function startSendProformaAgent(): Promise<void> {
  let isRunning = true;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const handleSignal = (signal: NodeJS.Signals): void => {
    logger.info(`${SEND_PROFORMA_LOG_PREFIX} Señal recibida: ${signal}`);
    isRunning = false;

    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  logger.info(`${SEND_PROFORMA_LOG_PREFIX} Agente de envío de proformas iniciado`);

  const scheduleNext = (): void => {
    if (!isRunning) {
      return;
    }

    timerId = setTimeout(async () => {
      try {
        await runSendProformaIteration();
      } catch (error) {
        logger.error({ err: error }, `${SEND_PROFORMA_LOG_PREFIX} Error en el ciclo del agente`);
      }

      scheduleNext();
    }, AGENT_POLL_INTERVAL_MS);
  };

  try {
    await runSendProformaIteration();
    scheduleNext();

    await new Promise<void>((resolvePromise) => {
      const waitForStop = setInterval(() => {
        if (!isRunning) {
          clearInterval(waitForStop);
          resolvePromise();
        }
      }, 250);
    });
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }

    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    logger.info(`${SEND_PROFORMA_LOG_PREFIX} Agente de envío de proformas detenido`);
  }
}

export { startSendProformaAgent };

startSendProformaAgent().catch((error) => {
  logger.error({ err: error }, `${SEND_PROFORMA_LOG_PREFIX} Send proforma agent failed`);
  process.exit(1);
});
