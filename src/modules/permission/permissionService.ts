import type { Role } from '../../config/databaseTypes.js';
import type { LoginUserDto } from '../auth/authDto.js';
import { findCompanyById } from '../company/companyDao.js';
import { findUserById } from '../user/userDao.js';
import { logger } from '../../utils/logger.js';
import type {
  PermissionResponseDto,
  UpdatePermissionItemDto,
  UpdateUserPermissionsDto,
  UserPermissionResponseDto,
} from './permissionDto.js';
import {
  findPermissions,
  findUserPermissions,
  saveUserPermissions,
  type UserPermissionRowDao,
} from './permissionDao.js';

const ROLE_RANK: Record<Role, number> = {
  empleado: 1,
  jefe: 2,
  administrador: 3,
};

const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no está activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no está activo';
const FORBIDDEN_ROL_USER_MESSAGE = 'El usuario no es jefe o administrador';
const INVALID_TARGET_USER_NOT_FOUND_MESSAGE = 'El usuario objetivo no existe';
const FORBIDDEN_TARGET_USER_ADMIN_MESSAGE =
  'No se pueden gestionar los permisos de un administrador';
const EMPTY_PERMISSIONS_MESSAGE = 'La lista de permisos es requerida';
const INVALID_PERMISSION_ITEM_MESSAGE = 'Cada permiso debe tener un código y un valor concedido';
const INVALID_PERMISSION_CODE_MESSAGE = 'Uno o más permisos no existen en el catálogo';

function isPermissionGranted(rol: Role, permission: UserPermissionRowDao): boolean {
  if (rol === 'administrador') {
    return true;
  }

  if (permission.upconcedido !== null) {
    return permission.upconcedido;
  }

  return ROLE_RANK[rol] >= ROLE_RANK[permission.perolminimo];
}

async function validateRequesterAccess(user: LoginUserDto): Promise<void> {
  const companyDB = await findCompanyById(user.usemid);
  if (!companyDB) {
    throw new Error(INVALID_COMPANY_FIND_MESSAGE);
  }

  if (companyDB.emestado !== 'activo') {
    throw new Error(INVALID_COMPANY_STATUS_MESSAGE);
  }

  const requesterDB = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!requesterDB) {
    throw new Error(INVALID_USER_NOT_FOUND_MESSAGE);
  }

  if (requesterDB.usestado !== 'activo') {
    throw new Error(INVALID_USER_STATUS_MESSAGE);
  }

  if (!['jefe', 'administrador'].includes(requesterDB.usrol)) {
    throw new Error(FORBIDDEN_ROL_USER_MESSAGE);
  }
}

async function validateTargetUser(
  targetUserId: string,
  user: LoginUserDto,
): Promise<{ usid: string; usrol: Role }> {
  const targetDB = await findUserById({
    usid: targetUserId,
    usemid: user.usemid,
  });

  if (!targetDB) {
    throw new Error(INVALID_TARGET_USER_NOT_FOUND_MESSAGE);
  }

  if (targetDB.usrol === 'administrador') {
    throw new Error(FORBIDDEN_TARGET_USER_ADMIN_MESSAGE);
  }

  return {
    usid: targetDB.usid,
    usrol: targetDB.usrol,
  };
}

function validateUpdateItems(permisos: UpdatePermissionItemDto[]): void {
  if (!Array.isArray(permisos) || permisos.length === 0) {
    throw new Error(EMPTY_PERMISSIONS_MESSAGE);
  }

  for (const item of permisos) {
    const hasValidCode = typeof item.codigo === 'string' && item.codigo.trim().length > 0;
    const hasValidGrant = typeof item.concedido === 'boolean' || item.concedido === null;

    if (!hasValidCode || !hasValidGrant) {
      throw new Error(INVALID_PERMISSION_ITEM_MESSAGE);
    }
  }
}

function buildUserPermissionsResponse(
  rol: Role,
  rows: UserPermissionRowDao[],
): UserPermissionResponseDto[] {
  return rows.map((row) => ({
    codigo: row.pecodigo,
    nombre: row.penombre,
    modulo: row.pemodulo,
    accion: row.peaccion,
    rolMinimo: row.perolminimo,
    override: row.upconcedido,
    efectivo: isPermissionGranted(rol, row),
  }));
}

async function loadUserPermissions(usid: string): Promise<UserPermissionRowDao[]> {
  return findUserPermissions(usid);
}

async function listPermissions(user: LoginUserDto): Promise<PermissionResponseDto[]> {
  try {
    await validateRequesterAccess(user);

    const rows = await findPermissions();

    return rows.map((row) => ({
      codigo: row.pecodigo,
      nombre: row.penombre,
      modulo: row.pemodulo,
      accion: row.peaccion,
      rolMinimo: row.perolminimo,
    }));
  } catch (error) {
    logger.error({ err: error, userId: user.usid }, 'Error al listar los permisos');
    throw error;
  }
}

async function readUserPermissions(
  targetUserId: string,
  user: LoginUserDto,
): Promise<UserPermissionResponseDto[]> {
  try {
    await validateRequesterAccess(user);
    const targetDB = await validateTargetUser(targetUserId, user);

    const rows = await findUserPermissions(targetDB.usid);

    return buildUserPermissionsResponse(targetDB.usrol, rows);
  } catch (error) {
    logger.error(
      { err: error, userId: user.usid, targetUserId },
      'Error al leer los permisos del usuario',
    );
    throw error;
  }
}

async function updateUserPermissions(
  data: UpdateUserPermissionsDto,
  user: LoginUserDto,
): Promise<UserPermissionResponseDto[]> {
  try {
    await validateRequesterAccess(user);
    const targetDB = await validateTargetUser(data.targetUserId, user);

    validateUpdateItems(data.permisos);

    const catalog = await findPermissions();
    const catalogCodes = new Set(catalog.map((permission) => permission.pecodigo));

    for (const item of data.permisos) {
      if (!catalogCodes.has(item.codigo)) {
        throw new Error(INVALID_PERMISSION_CODE_MESSAGE);
      }
    }

    await saveUserPermissions(targetDB.usid, user.usemid, data.permisos);

    const rows = await findUserPermissions(targetDB.usid);

    return buildUserPermissionsResponse(targetDB.usrol, rows);
  } catch (error) {
    logger.error(
      { err: error, userId: user.usid, targetUserId: data.targetUserId },
      'Error al actualizar los permisos del usuario',
    );
    throw error;
  }
}

export {
  isPermissionGranted,
  listPermissions,
  loadUserPermissions,
  readUserPermissions,
  updateUserPermissions,
};
