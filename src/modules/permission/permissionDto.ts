import type { Role } from '../../config/databaseTypes.js';

type PermissionResponseDto = {
  codigo: string;
  nombre: string;
  modulo: string;
  accion: string;
  rolMinimo: Role;
};

type UserPermissionResponseDto = {
  codigo: string;
  nombre: string;
  modulo: string;
  accion: string;
  rolMinimo: Role;
  override: boolean | null;
  efectivo: boolean;
};

type UpdatePermissionItemDto = {
  codigo: string;
  concedido: boolean | null;
};

type UpdateUserPermissionsDto = {
  targetUserId: string;
  permisos: UpdatePermissionItemDto[];
};

export type {
  PermissionResponseDto,
  UpdatePermissionItemDto,
  UpdateUserPermissionsDto,
  UserPermissionResponseDto,
};
