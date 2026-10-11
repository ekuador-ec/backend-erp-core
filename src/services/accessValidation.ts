import type { LoginUserDto } from '../modules/auth/authDto.js';
import { findCompanyById } from '../modules/company/companyDao.js';
import { findUserById } from '../modules/user/userDao.js';
import { createStatusCodeError } from '../utils/httpError.js';

const NOT_FOUND_STATUS_CODE = 404;
const FORBIDDEN_STATUS_CODE = 403;
const INVALID_COMPANY_FIND_MESSAGE = 'La empresa no existe';
const INVALID_COMPANY_STATUS_MESSAGE = 'La empresa no está activa';
const INVALID_USER_NOT_FOUND_MESSAGE = 'El usuario no existe';
const INVALID_USER_NOT_BELONG_COMPANY_MESSAGE = 'El usuario no pertenece a la empresa';
const FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE = 'El usuario no puede acceder a otra empresa';
const FORBIDDEN_ROL_USER_ADMIN_MESSAGE = 'El usuario no es administrador';
const INVALID_USER_STATUS_MESSAGE = 'El usuario no está activo';
const FORBIDDEN_COMPANY_CREATION_MESSAGE = 'La empresa no es una empresa padre';

type AccessValidationOptions = {
  requireParentCompany: boolean;
  requireAdminUser: boolean;
  targetCompanyId?: string;
};

async function validateCompanyAndUserAccess(
  user: LoginUserDto,
  options: AccessValidationOptions,
): Promise<void> {
  const { requireParentCompany, requireAdminUser, targetCompanyId } = options;

  const companyDB = await findCompanyById(user.usemid);
  if (!companyDB) {
    throw createStatusCodeError(INVALID_COMPANY_FIND_MESSAGE, NOT_FOUND_STATUS_CODE);
  }

  if (companyDB.emestado !== 'activo') {
    throw createStatusCodeError(INVALID_COMPANY_STATUS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  const userDB = await findUserById({
    usid: user.usid,
    usemid: user.usemid,
  });

  if (!userDB) {
    throw createStatusCodeError(INVALID_USER_NOT_FOUND_MESSAGE, NOT_FOUND_STATUS_CODE);
  }

  if (userDB.usemid !== user.usemid) {
    throw createStatusCodeError(INVALID_USER_NOT_BELONG_COMPANY_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (targetCompanyId && targetCompanyId !== user.usemid) {
    throw createStatusCodeError(FORBIDDEN_CROSS_COMPANY_ACCESS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (requireAdminUser && userDB.usrol !== 'administrador') {
    throw createStatusCodeError(FORBIDDEN_ROL_USER_ADMIN_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (userDB.usestado !== 'activo') {
    throw createStatusCodeError(INVALID_USER_STATUS_MESSAGE, FORBIDDEN_STATUS_CODE);
  }

  if (requireParentCompany && !companyDB.empadre) {
    throw createStatusCodeError(FORBIDDEN_COMPANY_CREATION_MESSAGE, FORBIDDEN_STATUS_CODE);
  }
}

export { validateCompanyAndUserAccess };
export type { AccessValidationOptions };
