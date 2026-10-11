import type { ErrorRequestHandler, RequestHandler } from 'express';

import { logger } from '../utils/logger.js';

const DEFAULT_ERROR_STATUS_CODE = 500;
const DEFAULT_ERROR_MESSAGE = 'Internal server error';

const hasStatusCode = (error: unknown): boolean => {
  return error instanceof Error && 'statusCode' in error;
};

const getStatusCode = (error: unknown): number => {
  if (!hasStatusCode(error)) {
    return DEFAULT_ERROR_STATUS_CODE;
  }

  const statusCode = Reflect.get(Object(error), 'statusCode');

  if (typeof statusCode !== 'number') {
    return DEFAULT_ERROR_STATUS_CODE;
  }

  return statusCode;
};

const getMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return DEFAULT_ERROR_MESSAGE;
};

const isServerError = (statusCode: number): boolean => {
  return statusCode >= DEFAULT_ERROR_STATUS_CODE;
};

const logError = (error: unknown, method: string, path: string, statusCode: number): void => {
  const logData = {
    err: error,
    method,
    path,
    statusCode,
  };

  if (isServerError(statusCode)) {
    logger.error(logData, 'La solicitud falló');
    return;
  }

  logger.warn(logData, 'La solicitud falló');
};

const notFoundHandler: RequestHandler = (req, res) => {
  const route = `${req.method} ${req.originalUrl}`;

  res.status(404).json({
    message: `Route ${route} not found`,
  });
};

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const statusCode = getStatusCode(error);
  const message = getMessage(error);

  logError(error, req.method, req.originalUrl, statusCode);

  res.status(statusCode).json({
    message,
  });
};

export { errorHandler, notFoundHandler };
