import type { RequestHandler } from 'express';
import type { Role } from '../config/databaseTypes.js';
import { createStatusCodeError } from '../utils/httpError.js';
import { extractBearerToken, verifyAccessToken, type AuthTokenPayload } from '../utils/jwt.js';

const UNAUTHORIZED_STATUS_CODE = 401;
const UNAUTHORIZED_MESSAGE = 'No autorizado';
const FORBIDDEN_STATUS_CODE = 403;
const FORBIDDEN_MESSAGE = 'No tienes permisos para realizar esta acción';

const authenticate: RequestHandler = (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const decodedPayload = verifyAccessToken(token) as Partial<AuthTokenPayload>;
    const { usid, usemid, usrol } = decodedPayload;

    if (
      typeof usid !== 'string' ||
      typeof usemid !== 'string' ||
      (usrol !== 'administrador' && usrol !== 'jefe' && usrol !== 'empleado')
    ) {
      throw new Error('La información del token es inválida');
    }

    req.auth = {
      usid,
      usemid,
      usrol,
    };

    next();
  } catch {
    next(createStatusCodeError(UNAUTHORIZED_MESSAGE, UNAUTHORIZED_STATUS_CODE));
  }
};

const requireRole = (roles: Role[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.auth) {
      next(createStatusCodeError(UNAUTHORIZED_MESSAGE, UNAUTHORIZED_STATUS_CODE));
      return;
    }

    if (!roles.includes(req.auth.usrol)) {
      next(createStatusCodeError(FORBIDDEN_MESSAGE, FORBIDDEN_STATUS_CODE));
      return;
    }

    next();
  };
};

const requireAdmin = requireRole(['administrador']);
const requireJefe = requireRole(['jefe']);
const requireJefeOrEmpleado = requireRole(['jefe', 'empleado']);

export { authenticate, requireAdmin, requireJefe, requireJefeOrEmpleado, requireRole };
