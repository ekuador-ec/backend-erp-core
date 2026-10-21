import type { RequestHandler } from 'express';
import type { LoginUserDto } from '../auth/authDto.js';
import type { UpdatePermissionItemDto, UpdateUserPermissionsDto } from './permissionDto.js';
import {
  listPermissions,
  readUserPermissions,
  updateUserPermissions,
} from './permissionService.js';

const searchPermissions: RequestHandler = async (req, res, next) => {
  try {
    const user: LoginUserDto = req.auth!;
    const permissionsDB = await listPermissions(user);

    res.status(200).json(permissionsDB);
  } catch (error) {
    next(error);
  }
};

const searchUserPermissions: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de usuario es requerido' });
      return;
    }

    const user: LoginUserDto = req.auth!;
    const permissionsDB = await readUserPermissions(id, user);

    res.status(200).json(permissionsDB);
  } catch (error) {
    next(error);
  }
};

const updateUserPermissionsData: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ message: 'El id de usuario es requerido' });
      return;
    }

    const body = req.body;
    const permisos: UpdatePermissionItemDto[] = body.permisos;
    const data: UpdateUserPermissionsDto = {
      targetUserId: id,
      permisos,
    };

    const user: LoginUserDto = req.auth!;
    const permissionsDB = await updateUserPermissions(data, user);

    res.status(200).json(permissionsDB);
  } catch (error) {
    next(error);
  }
};

export { searchPermissions, searchUserPermissions, updateUserPermissionsData };
