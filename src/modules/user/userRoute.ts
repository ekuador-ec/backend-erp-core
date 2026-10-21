import { Router } from 'express';
import { parseImage } from '../../middlewares/uploadImage.js';
import { authenticate } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/permission.js';
import { userPermissionRouter } from '../permission/permissionRoute.js';
import {
  registerUser,
  searchUser,
  searchUsers,
  updateUserData,
  updateUserPasswordData,
  updateUserStatus,
} from './userController.js';

const userRouter = Router();

userRouter.post(
  '/',
  parseImage,
  authenticate,
  requirePermission('modulo.usuario.activo'),
  registerUser,
);
userRouter.get('/', authenticate, requirePermission('modulo.usuario.activo'), searchUsers);
userRouter.get('/:id', authenticate, requirePermission('modulo.usuario.activo'), searchUser);
userRouter.patch(
  '/:id',
  authenticate,
  requirePermission('modulo.usuario.activo'),
  parseImage,
  updateUserData,
);
userRouter.patch(
  '/:id/password',
  authenticate,
  requirePermission('modulo.usuario.activo'),
  updateUserPasswordData,
);
userRouter.patch(
  '/:id/status',
  authenticate,
  requirePermission('modulo.usuario.activo'),
  updateUserStatus,
);

userRouter.use(userPermissionRouter);

export { userRouter };
