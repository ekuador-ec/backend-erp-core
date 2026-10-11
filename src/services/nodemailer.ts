import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';

import { logger } from '../utils/logger.js';

type TransporterConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

type SendEmailParams = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: SendMailOptions['attachments'];
};

function createTransporter(config: TransporterConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

async function sendEmail(transporter: Transporter, email: SendEmailParams): Promise<void> {
  const { from, to, subject, html, text, attachments } = email;

  if (to.length === 0) {
    logger.warn('La lista de destinatarios está vacía. Se omitió el envío del correo.');
    return;
  }

  try {
    const response = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      attachments,
    });

    logger.info({ messageId: response.messageId, subject }, 'Correo enviado correctamente');
  } catch (error) {
    logger.error({ err: error, subject }, 'Error al enviar el correo');
    throw error;
  }
}

export { createTransporter, sendEmail };
