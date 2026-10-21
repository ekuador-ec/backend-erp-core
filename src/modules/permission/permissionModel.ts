import type { Role, Status } from '../../config/databaseTypes.js';

type PermissionModel = {
  peid: string;
  pecodigo: string;
  penombre: string;
  pemodulo: string;
  peaccion: string;
  perolminimo: Role;
  peestado: Status;
  pefchregistro: Date;
};

type UserPermissionModel = {
  upid: string;
  upusid: string;
  uppeid: string;
  upemid: string;
  upconcedido: boolean;
  upfchregistro: Date;
};

export type { PermissionModel, UserPermissionModel };
