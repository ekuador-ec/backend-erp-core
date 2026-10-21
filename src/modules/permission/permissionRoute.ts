import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import {
  searchPermissions,
  searchUserPermissions,
  updateUserPermissionsData,
} from './permissionController.js';

const permissionRouter = Router();
const userPermissionRouter = Router();
const requireJefeOrAdmin = requireRole(['jefe', 'administrador']);

permissionRouter.get('/', authenticate, requireJefeOrAdmin, searchPermissions);

userPermissionRouter.get(
  '/:id/permissions',
  authenticate,
  requireJefeOrAdmin,
  searchUserPermissions,
);
userPermissionRouter.put(
  '/:id/permissions',
  authenticate,
  requireJefeOrAdmin,
  updateUserPermissionsData,
);

export { permissionRouter, userPermissionRouter };
