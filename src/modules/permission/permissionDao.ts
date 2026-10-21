import { sql } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { Role } from '../../config/databaseTypes.js';
import type { PermissionModel, UserPermissionModel } from './permissionModel.js';

type UpdateUserPermissionItemDao = {
  codigo: string;
  concedido: boolean | null;
};

type FindUserPermissionDao = {
  usid: string;
  codigo: string;
};

type SaveUserPermissionDao = {
  usid: string;
  emid: string;
  codigo: string;
  concedido: boolean;
};

type UpdateUserPermissionDao = {
  usid: string;
  codigo: string;
  concedido: boolean;
};

type UserPermissionRowDao = {
  pecodigo: string;
  penombre: string;
  pemodulo: string;
  peaccion: string;
  perolminimo: Role;
  upconcedido: boolean | null;
};

const FIND_PERMISSIONS_QUERY = `
  select peid, pecodigo, penombre, pemodulo, peaccion, perolminimo, peestado, pefchregistro
  from permiso
  where peestado = 'activo'
  order by pemodulo, peaccion
`;

async function findPermissions(): Promise<PermissionModel[]> {
  try {
    return await sql.unsafe<PermissionModel[]>(FIND_PERMISSIONS_QUERY);
  } catch (error) {
    logger.error({ err: error }, 'Error al buscar los permisos');
    throw new Error('Error al buscar los permisos');
  }
}

const FIND_USER_PERMISSIONS_QUERY = `
  select p.pecodigo, p.penombre, p.pemodulo, p.peaccion, p.perolminimo, up.upconcedido
  from permiso p
  left join permisousuario up
    on up.uppeid = p.peid
   and up.upusid = $1
  where p.peestado = 'activo'
  order by p.pemodulo, p.peaccion
`;

async function findUserPermissions(usid: string): Promise<UserPermissionRowDao[]> {
  try {
    return await sql.unsafe<UserPermissionRowDao[]>(FIND_USER_PERMISSIONS_QUERY, [usid]);
  } catch (error) {
    logger.error({ err: error, userId: usid }, 'Error al buscar los permisos del usuario');
    throw new Error('Error al buscar los permisos del usuario');
  }
}

const FIND_USER_PERMISSION_QUERY = `
  select up.upid, up.upusid, up.uppeid, up.upemid, up.upconcedido, up.upfchregistro
  from permisousuario up
  inner join permiso p on p.peid = up.uppeid
  where up.upusid = $1 and p.pecodigo = $2
`;

async function findUserPermission(
  permission: FindUserPermissionDao,
): Promise<UserPermissionModel | null> {
  const { usid, codigo } = permission;

  try {
    const result = await sql.unsafe<UserPermissionModel[]>(FIND_USER_PERMISSION_QUERY, [
      usid,
      codigo,
    ]);
    const userPermissionDB = result[0];

    if (!userPermissionDB) {
      return null;
    }

    return userPermissionDB;
  } catch (error) {
    logger.error({ err: error, userId: usid, codigo }, 'Error al buscar el permiso del usuario');
    throw new Error('Error al buscar el permiso del usuario');
  }
}

const SAVE_USER_PERMISSION_QUERY = `
  insert into permisousuario (upusid, uppeid, upemid, upconcedido)
  select $1, p.peid, $2, $3
  from permiso p
  where p.pecodigo = $4 and p.peestado = 'activo'
`;

async function saveUserPermission(permission: SaveUserPermissionDao): Promise<void> {
  const { usid, emid, codigo, concedido } = permission;

  try {
    await sql.unsafe(SAVE_USER_PERMISSION_QUERY, [usid, emid, concedido, codigo]);
  } catch (error) {
    logger.error(
      { err: error, userId: usid, companyId: emid, codigo },
      'Error al guardar el permiso del usuario',
    );
    throw new Error('Error al guardar el permiso del usuario');
  }
}

const UPDATE_USER_PERMISSION_QUERY = `
  update permisousuario up
  set upconcedido = $3
  from permiso p
  where up.uppeid = p.peid
    and up.upusid = $1
    and p.pecodigo = $2
`;

async function updateUserPermission(permission: UpdateUserPermissionDao): Promise<void> {
  const { usid, codigo, concedido } = permission;

  try {
    await sql.unsafe(UPDATE_USER_PERMISSION_QUERY, [usid, codigo, concedido]);
  } catch (error) {
    logger.error(
      { err: error, userId: usid, codigo, concedido },
      'Error al actualizar el permiso del usuario',
    );
    throw new Error('Error al actualizar el permiso del usuario');
  }
}

const DELETE_USER_PERMISSION_QUERY = `
  delete from permisousuario up
  using permiso p
  where up.uppeid = p.peid
    and up.upusid = $1
    and p.pecodigo = $2
`;

async function deleteUserPermission(permission: FindUserPermissionDao): Promise<void> {
  const { usid, codigo } = permission;

  try {
    await sql.unsafe(DELETE_USER_PERMISSION_QUERY, [usid, codigo]);
  } catch (error) {
    logger.error({ err: error, userId: usid, codigo }, 'Error al eliminar el permiso del usuario');
    throw new Error('Error al eliminar el permiso del usuario');
  }
}

async function saveUserPermissions(
  usid: string,
  emid: string,
  items: UpdateUserPermissionItemDao[],
): Promise<void> {
  try {
    for (const item of items) {
      if (item.concedido === null) {
        await deleteUserPermission({ usid, codigo: item.codigo });
        continue;
      }

      const userPermissionDB = await findUserPermission({ usid, codigo: item.codigo });

      if (userPermissionDB) {
        await updateUserPermission({ usid, codigo: item.codigo, concedido: item.concedido });
        continue;
      }

      await saveUserPermission({ usid, emid, codigo: item.codigo, concedido: item.concedido });
    }

    logger.info(
      { userId: usid, companyId: emid, total: items.length },
      'Permisos de usuario guardados',
    );
  } catch (error) {
    logger.error(
      { err: error, userId: usid, companyId: emid },
      'Error al guardar los permisos del usuario',
    );
    throw new Error('Error al guardar los permisos del usuario');
  }
}

export {
  deleteUserPermission,
  findPermissions,
  findUserPermission,
  findUserPermissions,
  saveUserPermission,
  saveUserPermissions,
  updateUserPermission,
};
export type { UserPermissionRowDao };
