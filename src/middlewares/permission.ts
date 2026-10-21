import type { RequestHandler } from 'express';
import {
  isPermissionGranted,
  loadUserPermissions,
} from '../modules/permission/permissionService.js';
import { logger } from '../utils/logger.js';
import { createStatusCodeError } from '../utils/httpError.js';

const UNAUTHORIZED_STATUS_CODE = 401;
const UNAUTHORIZED_MESSAGE = 'No autorizado';
const FORBIDDEN_STATUS_CODE = 403;
const FORBIDDEN_MESSAGE = 'El usuario no tiene acceso a este módulo';
const INVALID_PERMISSION_CODE_MESSAGE = 'El permiso solicitado no existe';

function requirePermission(codigo: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const auth = req.auth;

      if (!auth) {
        next(createStatusCodeError(UNAUTHORIZED_MESSAGE, UNAUTHORIZED_STATUS_CODE));
        return;
      }

      const permissions = await loadUserPermissions(auth.usid);
      const permission = permissions.find((item) => item.pecodigo === codigo);

      if (!permission) {
        logger.error(
          { userId: auth.usid, codigo },
          'Código de permiso no encontrado en el catálogo',
        );
        next(createStatusCodeError(INVALID_PERMISSION_CODE_MESSAGE, FORBIDDEN_STATUS_CODE));
        return;
      }

      if (!isPermissionGranted(auth.usrol, permission)) {
        next(createStatusCodeError(FORBIDDEN_MESSAGE, FORBIDDEN_STATUS_CODE));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export { requirePermission };
